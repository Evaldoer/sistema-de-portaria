from flask import Flask, jsonify, request

from database.bootstrap import bootstrap_database
from routes import entregas_bp, portaria_bp

app = Flask(__name__)

bootstrap_database()

app.register_blueprint(entregas_bp, url_prefix="/entregas")
app.register_blueprint(portaria_bp, url_prefix="/api")


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def options_handler(_path):
    return ("", 204)


@app.route("/")
def home():
    return {
        "message": "Sistema de Portaria API",
        "modulos": [
            "dashboard",
            "moradores",
            "visitantes",
            "veiculos",
            "entregas",
            "ocorrencias",
            "reservas",
        ],
    }


@app.route("/health")
def health():
    return jsonify({"status": "ok", "method": request.method})


if __name__ == "__main__":
    app.run(debug=True)
