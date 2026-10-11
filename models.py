
from datetime import datetime, timezone

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")

    reports = db.relationship(
        "Item", back_populates="reporter", lazy=True
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(1000), nullable=False)
    type = db.Column(db.String(10), nullable=False)  # Lost or Found
    status = db.Column(db.String(20), nullable=False, default="Open")
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=False
    )
    reporter = db.relationship("User", back_populates="reports")

    claims = db.relationship(
        "Claim", back_populates="item", cascade="all, delete-orphan"
    )


class Claim(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(1000), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    item_id = db.Column(
        db.Integer, db.ForeignKey("item.id"), nullable=False
    )
    claimant_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=False
    )

    item = db.relationship("Item", back_populates="claims")
    claimant = db.relationship("User")

    __table_args__ = (
        db.UniqueConstraint(
            "item_id", "claimant_id", name="unique_claim_per_user_item"
        ),
    )
