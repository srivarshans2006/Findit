
import pytest

from app import app as flask_app
from models import db, User


@pytest.fixture
def client(tmp_path):
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{tmp_path / 'test.db'}",
        SECRET_KEY="test-secret-key",
        WTF_CSRF_ENABLED=False,
    )

    with flask_app.app_context():
        db.create_all()

        user = User(
            name="Test Student",
            email="student@example.com",
        )
        user.set_password("testpassword123")
        db.session.add(user)
        db.session.commit()

    with flask_app.test_client() as test_client:
        yield test_client

    with flask_app.app_context():
        db.session.remove()
        db.drop_all()


def test_home_page(client):
    response = client.get("/")
    assert response.status_code == 200


def test_register_page(client):
    response = client.get("/register")
    assert response.status_code == 200


def test_login_page(client):
    response = client.get("/login")
    assert response.status_code == 200


def test_claims_requires_login(client):
    response = client.get("/claims")
    assert response.status_code == 302
    assert "/login" in response.location
