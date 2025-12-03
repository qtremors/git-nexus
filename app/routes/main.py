from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    return render_template("index.html", page="discover")


@main_bp.route("/watchlist")
def watchlist():
    return render_template("watchlist.html", page="watchlist")


@main_bp.route("/settings")
def settings():
    return render_template("settings.html", page="settings")
