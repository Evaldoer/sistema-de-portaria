from flask import Blueprint, jsonify, request

from database.db import SessionLocal
from models import (
    Entrega,
    Morador,
    Ocorrencia,
    ReservaArea,
    StatusEntrega,
    StatusOcorrencia,
    StatusReserva,
    StatusVisitante,
    TipoVeiculo,
    Veiculo,
    Visitante,
)
from utils.timezone import local_now

portaria_bp = Blueprint("portaria", __name__)


def _missing_fields(data, fields):
    return [field for field in fields if not data.get(field)]


def _enum_or_none(enum_class, value):
    try:
        return enum_class(value)
    except ValueError:
        return None


def _response_not_found(label):
    return jsonify({"erro": f"{label} nao encontrado(a)"}), 404


@portaria_bp.route("/dashboard/resumo", methods=["GET"])
def dashboard_resumo():
    db = SessionLocal()
    try:
        return jsonify(
            {
                "metricas": {
                    "moradores": db.query(Morador).count(),
                    "visitantes_ativos": db.query(Visitante).filter(Visitante.status == StatusVisitante.em_visita).count(),
                    "entregas_pendentes": db.query(Entrega).filter(Entrega.status == StatusEntrega.pendente).count(),
                    "ocorrencias_abertas": db.query(Ocorrencia).filter(Ocorrencia.status != StatusOcorrencia.resolvida).count(),
                    "reservas_confirmadas": db.query(ReservaArea).filter(ReservaArea.status == StatusReserva.confirmada).count(),
                },
                "recentes": {
                    "visitantes": [
                        item.to_dict()
                        for item in db.query(Visitante).order_by(Visitante.created_at.desc(), Visitante.id.desc()).limit(5).all()
                    ],
                    "ocorrencias": [
                        item.to_dict()
                        for item in db.query(Ocorrencia).order_by(Ocorrencia.created_at.desc(), Ocorrencia.id.desc()).limit(5).all()
                    ],
                    "entregas": [
                        item.to_dict()
                        for item in db.query(Entrega).order_by(Entrega.created_at.desc(), Entrega.id.desc()).limit(5).all()
                    ],
                },
            }
        )
    finally:
        db.close()


@portaria_bp.route("/seed", methods=["POST"])
def seed_portaria():
    db = SessionLocal()
    try:
        if db.query(Morador).count() == 0:
            db.add_all(
                [
                    Morador(nome="Ana Souza", apartamento="101", telefone="11999990001", email="ana@condominio.com", bloco="A"),
                    Morador(nome="Carlos Lima", apartamento="202", telefone="11999990002", email="carlos@condominio.com", bloco="B"),
                ]
            )

        if db.query(Visitante).count() == 0:
            db.add_all(
                [
                    Visitante(
                        nome="Joao Martins",
                        documento="12345678900",
                        morador_nome="Ana Souza",
                        apartamento="101",
                        motivo="Visita familiar",
                        status=StatusVisitante.em_visita,
                        entrada_em=local_now(),
                    ),
                    Visitante(
                        nome="Marina Costa",
                        documento="98765432100",
                        morador_nome="Carlos Lima",
                        apartamento="202",
                        motivo="Prestadora de servico",
                        status=StatusVisitante.autorizado,
                    ),
                ]
            )

        if db.query(Veiculo).count() == 0:
            db.add_all(
                [
                    Veiculo(placa="ABC1D23", modelo="Corolla", cor="Prata", morador_nome="Ana Souza", apartamento="101", tipo=TipoVeiculo.carro, vaga="12"),
                    Veiculo(placa="XYZ9K87", modelo="CG 160", cor="Preta", morador_nome="Carlos Lima", apartamento="202", tipo=TipoVeiculo.moto, vaga="M-03"),
                ]
            )

        if db.query(Ocorrencia).count() == 0:
            db.add_all(
                [
                    Ocorrencia(
                        titulo="Luz da garagem intermitente",
                        categoria="Manutencao",
                        local="Garagem bloco B",
                        prioridade="media",
                        responsavel="Equipe predial",
                        status=StatusOcorrencia.em_andamento,
                        descricao="Moradores reportaram oscilacao de energia no corredor da garagem.",
                    ),
                    Ocorrencia(
                        titulo="Barulho apos horario",
                        categoria="Convivencia",
                        local="Salao de festas",
                        prioridade="alta",
                        responsavel="Portaria noturna",
                        status=StatusOcorrencia.aberta,
                        descricao="Ocorrencia aberta para registro e contato com o responsavel pela unidade.",
                    ),
                ]
            )

        if db.query(ReservaArea).count() == 0:
            db.add_all(
                [
                    ReservaArea(area="Salao de festas", morador_nome="Ana Souza", apartamento="101", data_reserva="2026-04-27", horario="18:00 - 22:00", convidados=25, status=StatusReserva.confirmada),
                    ReservaArea(area="Churrasqueira", morador_nome="Carlos Lima", apartamento="202", data_reserva="2026-04-30", horario="12:00 - 16:00", convidados=12, status=StatusReserva.solicitada),
                ]
            )

        if db.query(Entrega).count() == 0:
            db.add_all(
                [
                    Entrega(descricao="Encomenda Mercado Livre", apartamento="101", morador_nome="Ana Souza", recebedor_nome="Portaria"),
                    Entrega(
                        descricao="Pedido de farmacia",
                        apartamento="202",
                        morador_nome="Carlos Lima",
                        recebedor_nome="Portaria",
                        qr_code="QRCODE-2026-0002",
                        codigo_barras="7891234567890",
                    ),
                ]
            )

        db.commit()
        return jsonify({"msg": "Base inicial da portaria criada com sucesso"})
    finally:
        db.close()


@portaria_bp.route("/moradores", methods=["GET"])
def listar_moradores():
    db = SessionLocal()
    try:
        moradores = db.query(Morador).order_by(Morador.apartamento.asc(), Morador.nome.asc()).all()
        return jsonify([item.to_dict() for item in moradores])
    finally:
        db.close()


@portaria_bp.route("/moradores", methods=["POST"])
def criar_morador():
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        missing = _missing_fields(data, ["nome", "apartamento", "telefone"])
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        morador = Morador(
            nome=data["nome"].strip(),
            apartamento=data["apartamento"].strip(),
            telefone=data["telefone"].strip(),
            email=data.get("email"),
            bloco=data.get("bloco"),
            observacao=data.get("observacao"),
            ativo=bool(data.get("ativo", True)),
        )
        db.add(morador)
        db.commit()
        db.refresh(morador)
        return jsonify(morador.to_dict()), 201
    finally:
        db.close()


@portaria_bp.route("/moradores/<int:item_id>", methods=["PUT"])
def atualizar_morador(item_id):
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        morador = db.query(Morador).filter(Morador.id == item_id).first()
        if not morador:
            return _response_not_found("Morador")

        for field in ["nome", "apartamento", "telefone", "email", "bloco", "observacao"]:
            if field in data:
                setattr(morador, field, data[field])
        if "ativo" in data:
            morador.ativo = bool(data["ativo"])

        morador.updated_at = local_now()
        db.commit()
        db.refresh(morador)
        return jsonify(morador.to_dict())
    finally:
        db.close()


@portaria_bp.route("/moradores/<int:item_id>", methods=["DELETE"])
def deletar_morador(item_id):
    db = SessionLocal()
    try:
        morador = db.query(Morador).filter(Morador.id == item_id).first()
        if not morador:
            return _response_not_found("Morador")
        db.delete(morador)
        db.commit()
        return jsonify({"msg": "Morador removido com sucesso"})
    finally:
        db.close()


@portaria_bp.route("/visitantes", methods=["GET"])
def listar_visitantes():
    db = SessionLocal()
    try:
        visitantes = db.query(Visitante).order_by(Visitante.created_at.desc(), Visitante.id.desc()).all()
        return jsonify([item.to_dict() for item in visitantes])
    finally:
        db.close()


@portaria_bp.route("/visitantes", methods=["POST"])
def criar_visitante():
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        missing = _missing_fields(data, ["nome", "documento", "morador_nome", "apartamento", "motivo"])
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        status = _enum_or_none(StatusVisitante, data.get("status", StatusVisitante.autorizado.value))
        if not status:
            return jsonify({"erro": "Status de visitante invalido"}), 400

        visitante = Visitante(
            nome=data["nome"].strip(),
            documento=data["documento"].strip(),
            morador_nome=data["morador_nome"].strip(),
            apartamento=data["apartamento"].strip(),
            motivo=data["motivo"].strip(),
            status=status,
            entrada_em=local_now() if status == StatusVisitante.em_visita else None,
            saida_em=local_now() if status == StatusVisitante.finalizado else None,
            observacao=data.get("observacao"),
        )
        db.add(visitante)
        db.commit()
        db.refresh(visitante)
        return jsonify(visitante.to_dict()), 201
    finally:
        db.close()


@portaria_bp.route("/visitantes/<int:item_id>", methods=["PUT"])
def atualizar_visitante(item_id):
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        visitante = db.query(Visitante).filter(Visitante.id == item_id).first()
        if not visitante:
            return _response_not_found("Visitante")

        for field in ["nome", "documento", "morador_nome", "apartamento", "motivo", "observacao"]:
            if field in data:
                setattr(visitante, field, data[field])

        if "status" in data:
            status = _enum_or_none(StatusVisitante, data["status"])
            if not status:
                return jsonify({"erro": "Status de visitante invalido"}), 400
            visitante.status = status
            if status == StatusVisitante.em_visita and not visitante.entrada_em:
                visitante.entrada_em = local_now()
            if status == StatusVisitante.finalizado:
                visitante.saida_em = local_now()

        visitante.updated_at = local_now()
        db.commit()
        db.refresh(visitante)
        return jsonify(visitante.to_dict())
    finally:
        db.close()


@portaria_bp.route("/visitantes/<int:item_id>", methods=["DELETE"])
def deletar_visitante(item_id):
    db = SessionLocal()
    try:
        visitante = db.query(Visitante).filter(Visitante.id == item_id).first()
        if not visitante:
            return _response_not_found("Visitante")
        db.delete(visitante)
        db.commit()
        return jsonify({"msg": "Visitante removido com sucesso"})
    finally:
        db.close()


@portaria_bp.route("/veiculos", methods=["GET"])
def listar_veiculos():
    db = SessionLocal()
    try:
        veiculos = db.query(Veiculo).order_by(Veiculo.created_at.desc(), Veiculo.id.desc()).all()
        return jsonify([item.to_dict() for item in veiculos])
    finally:
        db.close()


@portaria_bp.route("/veiculos", methods=["POST"])
def criar_veiculo():
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        missing = _missing_fields(data, ["placa", "modelo", "cor", "morador_nome", "apartamento"])
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        tipo = _enum_or_none(TipoVeiculo, data.get("tipo", TipoVeiculo.carro.value))
        if not tipo:
            return jsonify({"erro": "Tipo de veiculo invalido"}), 400

        placa = data["placa"].strip().upper()
        existente = db.query(Veiculo).filter(Veiculo.placa == placa).first()
        if existente:
            return jsonify({"erro": "Ja existe um veiculo com esta placa"}), 400

        veiculo = Veiculo(
            placa=placa,
            modelo=data["modelo"].strip(),
            cor=data["cor"].strip(),
            morador_nome=data["morador_nome"].strip(),
            apartamento=data["apartamento"].strip(),
            tipo=tipo,
            vaga=data.get("vaga"),
            observacao=data.get("observacao"),
        )
        db.add(veiculo)
        db.commit()
        db.refresh(veiculo)
        return jsonify(veiculo.to_dict()), 201
    finally:
        db.close()


@portaria_bp.route("/veiculos/<int:item_id>", methods=["PUT"])
def atualizar_veiculo(item_id):
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        veiculo = db.query(Veiculo).filter(Veiculo.id == item_id).first()
        if not veiculo:
            return _response_not_found("Veiculo")

        for field in ["modelo", "cor", "morador_nome", "apartamento", "vaga", "observacao"]:
            if field in data:
                setattr(veiculo, field, data[field])
        if "placa" in data and data["placa"]:
            veiculo.placa = data["placa"].strip().upper()
        if "tipo" in data:
            tipo = _enum_or_none(TipoVeiculo, data["tipo"])
            if not tipo:
                return jsonify({"erro": "Tipo de veiculo invalido"}), 400
            veiculo.tipo = tipo

        veiculo.updated_at = local_now()
        db.commit()
        db.refresh(veiculo)
        return jsonify(veiculo.to_dict())
    finally:
        db.close()


@portaria_bp.route("/veiculos/<int:item_id>", methods=["DELETE"])
def deletar_veiculo(item_id):
    db = SessionLocal()
    try:
        veiculo = db.query(Veiculo).filter(Veiculo.id == item_id).first()
        if not veiculo:
            return _response_not_found("Veiculo")
        db.delete(veiculo)
        db.commit()
        return jsonify({"msg": "Veiculo removido com sucesso"})
    finally:
        db.close()


@portaria_bp.route("/ocorrencias", methods=["GET"])
def listar_ocorrencias():
    db = SessionLocal()
    try:
        ocorrencias = db.query(Ocorrencia).order_by(Ocorrencia.created_at.desc(), Ocorrencia.id.desc()).all()
        return jsonify([item.to_dict() for item in ocorrencias])
    finally:
        db.close()


@portaria_bp.route("/ocorrencias", methods=["POST"])
def criar_ocorrencia():
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        missing = _missing_fields(data, ["titulo", "categoria", "local", "responsavel", "descricao"])
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        status = _enum_or_none(StatusOcorrencia, data.get("status", StatusOcorrencia.aberta.value))
        if not status:
            return jsonify({"erro": "Status de ocorrencia invalido"}), 400

        ocorrencia = Ocorrencia(
            titulo=data["titulo"].strip(),
            categoria=data["categoria"].strip(),
            local=data["local"].strip(),
            prioridade=(data.get("prioridade") or "media").strip(),
            responsavel=data["responsavel"].strip(),
            descricao=data["descricao"].strip(),
            status=status,
        )
        db.add(ocorrencia)
        db.commit()
        db.refresh(ocorrencia)
        return jsonify(ocorrencia.to_dict()), 201
    finally:
        db.close()


@portaria_bp.route("/ocorrencias/<int:item_id>", methods=["PUT"])
def atualizar_ocorrencia(item_id):
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        ocorrencia = db.query(Ocorrencia).filter(Ocorrencia.id == item_id).first()
        if not ocorrencia:
            return _response_not_found("Ocorrencia")

        for field in ["titulo", "categoria", "local", "prioridade", "responsavel", "descricao"]:
            if field in data:
                setattr(ocorrencia, field, data[field])
        if "status" in data:
            status = _enum_or_none(StatusOcorrencia, data["status"])
            if not status:
                return jsonify({"erro": "Status de ocorrencia invalido"}), 400
            ocorrencia.status = status

        ocorrencia.updated_at = local_now()
        db.commit()
        db.refresh(ocorrencia)
        return jsonify(ocorrencia.to_dict())
    finally:
        db.close()


@portaria_bp.route("/ocorrencias/<int:item_id>", methods=["DELETE"])
def deletar_ocorrencia(item_id):
    db = SessionLocal()
    try:
        ocorrencia = db.query(Ocorrencia).filter(Ocorrencia.id == item_id).first()
        if not ocorrencia:
            return _response_not_found("Ocorrencia")
        db.delete(ocorrencia)
        db.commit()
        return jsonify({"msg": "Ocorrencia removida com sucesso"})
    finally:
        db.close()


@portaria_bp.route("/reservas", methods=["GET"])
def listar_reservas():
    db = SessionLocal()
    try:
        reservas = db.query(ReservaArea).order_by(ReservaArea.data_reserva.asc(), ReservaArea.id.desc()).all()
        return jsonify([item.to_dict() for item in reservas])
    finally:
        db.close()


@portaria_bp.route("/reservas", methods=["POST"])
def criar_reserva():
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        missing = _missing_fields(data, ["area", "morador_nome", "apartamento", "data_reserva", "horario"])
        if missing:
            return jsonify({"erro": "Campos obrigatorios ausentes", "campos": missing}), 400

        status = _enum_or_none(StatusReserva, data.get("status", StatusReserva.solicitada.value))
        if not status:
            return jsonify({"erro": "Status de reserva invalido"}), 400

        reserva = ReservaArea(
            area=data["area"].strip(),
            morador_nome=data["morador_nome"].strip(),
            apartamento=data["apartamento"].strip(),
            data_reserva=data["data_reserva"].strip(),
            horario=data["horario"].strip(),
            convidados=int(data.get("convidados", 0) or 0),
            status=status,
            observacao=data.get("observacao"),
        )
        db.add(reserva)
        db.commit()
        db.refresh(reserva)
        return jsonify(reserva.to_dict()), 201
    finally:
        db.close()


@portaria_bp.route("/reservas/<int:item_id>", methods=["PUT"])
def atualizar_reserva(item_id):
    db = SessionLocal()
    data = request.get_json() or {}
    try:
        reserva = db.query(ReservaArea).filter(ReservaArea.id == item_id).first()
        if not reserva:
            return _response_not_found("Reserva")

        for field in ["area", "morador_nome", "apartamento", "data_reserva", "horario", "observacao"]:
            if field in data:
                setattr(reserva, field, data[field])
        if "convidados" in data:
            reserva.convidados = int(data["convidados"] or 0)
        if "status" in data:
            status = _enum_or_none(StatusReserva, data["status"])
            if not status:
                return jsonify({"erro": "Status de reserva invalido"}), 400
            reserva.status = status

        reserva.updated_at = local_now()
        db.commit()
        db.refresh(reserva)
        return jsonify(reserva.to_dict())
    finally:
        db.close()


@portaria_bp.route("/reservas/<int:item_id>", methods=["DELETE"])
def deletar_reserva(item_id):
    db = SessionLocal()
    try:
        reserva = db.query(ReservaArea).filter(ReservaArea.id == item_id).first()
        if not reserva:
            return _response_not_found("Reserva")
        db.delete(reserva)
        db.commit()
        return jsonify({"msg": "Reserva removida com sucesso"})
    finally:
        db.close()
