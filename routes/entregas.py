from flask import Blueprint, jsonify, request

from database.db import SessionLocal
from models.entrega import Entrega, StatusEntrega
from utils.timezone import local_now

entregas_bp = Blueprint("entregas", __name__)


def _parse_status(status):
    try:
        return StatusEntrega(status)
    except ValueError:
        return None


@entregas_bp.route("/", methods=["GET"])
def listar_entregas():
    db = SessionLocal()
    try:
        entregas = db.query(Entrega).order_by(Entrega.created_at.desc(), Entrega.id.desc()).all()
        return jsonify([entrega.to_dict() for entrega in entregas])
    finally:
        db.close()


@entregas_bp.route("/<int:item_id>", methods=["GET"])
def buscar_entrega(item_id):
    db = SessionLocal()
    try:
        entrega = db.query(Entrega).filter(Entrega.id == item_id).first()
        if not entrega:
            return jsonify({"erro": "Entrega nao encontrada"}), 404
        return jsonify(entrega.to_dict())
    finally:
        db.close()


@entregas_bp.route("/", methods=["POST"])
def criar_entrega():
    db = SessionLocal()
    data = request.get_json() or {}

    try:
        required_fields = ["descricao", "apartamento", "morador_nome"]
        missing = [field for field in required_fields if not data.get(field)]
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        entrega = Entrega(
            descricao=data["descricao"].strip(),
            apartamento=data["apartamento"].strip(),
            morador_nome=data["morador_nome"].strip(),
            recebedor_nome=(data.get("recebedor_nome") or "Portaria").strip(),
            observacao=data.get("observacao"),
            status=StatusEntrega.pendente,
            data_recebimento=local_now(),
        )
        db.add(entrega)
        db.commit()
        db.refresh(entrega)
        return jsonify(entrega.to_dict()), 201
    finally:
        db.close()


@entregas_bp.route("/<int:item_id>", methods=["PUT"])
def atualizar_entrega(item_id):
    db = SessionLocal()
    data = request.get_json() or {}

    try:
        entrega = db.query(Entrega).filter(Entrega.id == item_id).first()
        if not entrega:
            return jsonify({"erro": "Entrega nao encontrada"}), 404

        if "descricao" in data and data["descricao"]:
            entrega.descricao = data["descricao"].strip()
        if "apartamento" in data and data["apartamento"]:
            entrega.apartamento = data["apartamento"].strip()
        if "morador_nome" in data and data["morador_nome"]:
            entrega.morador_nome = data["morador_nome"].strip()
        if "recebedor_nome" in data and data["recebedor_nome"]:
            entrega.recebedor_nome = data["recebedor_nome"].strip()
        if "observacao" in data:
            entrega.observacao = data["observacao"]
        if "status" in data:
            parsed_status = _parse_status(data["status"])
            if not parsed_status:
                return jsonify({"erro": "Status invalido"}), 400
            entrega.status = parsed_status
            entrega.data_entrega = local_now() if parsed_status == StatusEntrega.entregue else None

        entrega.updated_at = local_now()
        db.commit()
        db.refresh(entrega)
        return jsonify(entrega.to_dict())
    finally:
        db.close()


@entregas_bp.route("/<int:item_id>", methods=["DELETE"])
def deletar_entrega(item_id):
    db = SessionLocal()
    try:
        entrega = db.query(Entrega).filter(Entrega.id == item_id).first()
        if not entrega:
            return jsonify({"erro": "Entrega nao encontrada"}), 404

        db.delete(entrega)
        db.commit()
        return jsonify({"msg": "Entrega removida com sucesso"})
    finally:
        db.close()
