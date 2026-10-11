
from app import app
from models import db, User

with app.app_context():
    email = input("Enter your registered email: ").strip().lower()

    user = db.session.scalar(
        db.select(User).where(User.email == email)
    )

    if user:
        user.role = "admin"
        db.session.commit()
        print(f"{user.email} is now an admin.")
    else:
        print("User not found. Register this account first.")
