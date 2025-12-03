import os
from flask import Flask
from .models import db
from config import Config

def create_app():
    # Helper to find templates/static when running from root
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(Config)

    db.init_app(app)

    with app.app_context():
        # Create DB in instance folder
        os.makedirs(os.path.join(app.root_path, '..', 'instance'), exist_ok=True)
        db.create_all()

    # Register Blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    return app