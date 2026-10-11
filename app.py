
import os
from datetime import datetime, timezone
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, abort
)
from flask_login import (
    LoginManager, current_user, login_user, logout_user, login_required
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from models import db, User, Item, Claim

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY", "dev-only-change-this-before-deployment"
)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///findit.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "admin":
            abort(403)
        return view(*args, **kwargs)
    return wrapped


with app.app_context():
    db.create_all()


@app.route("/")
def home():
    items = db.session.scalars(
        select(Item).order_by(Item.created_at.desc())
    ).all()
    return render_template("index.html", items=items)


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("home"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not name or not email or len(password) < 8:
            flash("Enter your name, a valid email, and a password of at least 8 characters.")
            return render_template("register.html")

        user = User(name=name, email=email)
        user.set_password(password)
        db.session.add(user)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("An account with this email already exists.")
            return render_template("register.html")

        login_user(user)
        flash("Account created successfully.")
        return redirect(url_for("home"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("home"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = db.session.scalar(
            select(User).where(User.email == email)
        )

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for("home"))

        flash("Invalid email or password.")

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    flash("You have been logged out.")
    return redirect(url_for("home"))


@app.route("/report", methods=["POST"])
@login_required
def report_item():
    name = request.form.get("name", "").strip()
    category = request.form.get("category", "").strip()
    location = request.form.get("location", "").strip()
    description = request.form.get("description", "").strip()
    item_type = request.form.get("type", "").strip()

    if (
        not name or len(name) > 100
        or not category or len(category) > 50
        or not location or len(location) > 150
        or not description or len(description) > 1000
        or item_type not in {"Lost", "Found"}
    ):
        flash("Please complete the form with valid information.")
        return redirect(url_for("home"))

    item = Item(
        name=name,
        category=category,
        location=location,
        description=description,
        type=item_type,
        user_id=current_user.id
    )

    db.session.add(item)
    db.session.commit()

    flash("Your item report has been saved.")
    return redirect(url_for("home"))



@app.route("/claim/<int:item_id>", methods=["POST"])
@login_required
def claim_item(item_id):
    item = db.get_or_404(Item, item_id)

    # Only Found items can be claimed
    if item.type != "Found":
        flash("You can only claim items reported as Found.")
        return redirect(url_for("home"))

    # Users cannot claim their own reports
    if item.user_id == current_user.id:
        flash("You cannot claim your own report.")
        return redirect(url_for("home"))

    # Only open items accept claims
    if item.status != "Open":
        flash("This item is no longer accepting claims.")
        return redirect(url_for("home"))

    message = request.form.get("message", "").strip()

    if not message or len(message) > 1000:
        flash("Please provide a claim message.")
        return redirect(url_for("home"))

    claim = Claim(
        item_id=item.id,
        claimant_id=current_user.id,
        message=message
    )

    db.session.add(claim)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        flash("You have already submitted a claim for this item.")
        return redirect(url_for("home"))

    flash("Your claim request has been submitted.")
    return redirect(url_for("home"))



@app.route("/claims")
@login_required
def my_claims():
    claims = db.session.scalars(
        select(Claim)
        .where(Claim.claimant_id == current_user.id)
        .order_by(Claim.created_at.desc())
    ).all()
    return render_template("claims.html", claims=claims)


@app.route("/admin/claims/<int:claim_id>", methods=["POST"])
@admin_required
def review_claim(claim_id):
    claim = db.get_or_404(Claim, claim_id)
    decision = request.form.get("decision", "")

    if decision == "Approve" and claim.status == "Pending":
        if claim.item.status != "Open":
            flash("This item is no longer available for approval.")
            return redirect(url_for("admin_claims"))

        claim.status = "Approved"
        claim.item.status = "Claimed"

    elif decision == "Reject" and claim.status == "Pending":
        claim.status = "Rejected"

    else:
        flash("Invalid claim action.")
        return redirect(url_for("admin_claims"))

    db.session.commit()
    flash("Claim status updated.")
    return redirect(url_for("admin_claims"))



@app.route("/admin/claims/<int:claim_id>/returned", methods=["POST"])
@admin_required
def mark_item_returned(claim_id):
    claim = db.get_or_404(Claim, claim_id)
    item = claim.item

    # Only an approved claim can be marked as returned
    if claim.status != "Approved":
        flash("Only approved claims can be marked as returned.")
        return redirect(url_for("admin_claims"))

    # Prevent invalid status changes
    if item.status != "Claimed":
        flash("This item is not currently marked as claimed.")
        return redirect(url_for("admin_claims"))

    item.status = "Returned"
    db.session.commit()

    flash("Item successfully marked as returned.")
    return redirect(url_for("admin_claims"))



@app.route("/admin/claims")
@admin_required
def admin_claims():
    claims = db.session.scalars(
        select(Claim).order_by(Claim.created_at.desc())
    ).all()
    return render_template("admin_claims.html", claims=claims)


if __name__ == "__main__":
    app.run(debug=True)
