from datetime import datetime
import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text

from database.db import Base
from utils.timezone import local_now


class SerializableMixin:
    def _serialize_value(self, value):
        if isinstance(value, enum.Enum):
            return value.value
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def to_dict(self):
        return {
            column.name: self._serialize_value(getattr(self, column.name))
            for column in self.__table__.columns
        }


class Morador(SerializableMixin, Base):
    __tablename__ = "moradores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False)
    apartamento = Column(String(50), nullable=False)
    telefone = Column(String(30), nullable=False)
    email = Column(String(120), nullable=True)
    bloco = Column(String(30), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    observacao = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)


class StatusVisitante(enum.Enum):
    autorizado = "autorizado"
    em_visita = "em_visita"
    finalizado = "finalizado"


class Visitante(SerializableMixin, Base):
    __tablename__ = "visitantes"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False)
    documento = Column(String(40), nullable=False)
    morador_nome = Column(String(120), nullable=False)
    apartamento = Column(String(50), nullable=False)
    motivo = Column(String(150), nullable=False)
    status = Column(Enum(StatusVisitante), nullable=False, default=StatusVisitante.autorizado)
    autorizado_em = Column(DateTime, nullable=False, default=local_now)
    entrada_em = Column(DateTime, nullable=True)
    saida_em = Column(DateTime, nullable=True)
    observacao = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)


class TipoVeiculo(enum.Enum):
    carro = "carro"
    moto = "moto"
    utilitario = "utilitario"
    outro = "outro"


class Veiculo(SerializableMixin, Base):
    __tablename__ = "veiculos"

    id = Column(Integer, primary_key=True, index=True)
    placa = Column(String(20), nullable=False, unique=True)
    modelo = Column(String(80), nullable=False)
    cor = Column(String(40), nullable=False)
    morador_nome = Column(String(120), nullable=False)
    apartamento = Column(String(50), nullable=False)
    tipo = Column(Enum(TipoVeiculo), nullable=False, default=TipoVeiculo.carro)
    vaga = Column(String(30), nullable=True)
    observacao = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)


class StatusOcorrencia(enum.Enum):
    aberta = "aberta"
    em_andamento = "em_andamento"
    resolvida = "resolvida"


class Ocorrencia(SerializableMixin, Base):
    __tablename__ = "ocorrencias"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(150), nullable=False)
    categoria = Column(String(80), nullable=False)
    local = Column(String(120), nullable=False)
    prioridade = Column(String(30), nullable=False, default="media")
    responsavel = Column(String(120), nullable=False)
    status = Column(Enum(StatusOcorrencia), nullable=False, default=StatusOcorrencia.aberta)
    descricao = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)


class StatusReserva(enum.Enum):
    solicitada = "solicitada"
    confirmada = "confirmada"
    cancelada = "cancelada"


class ReservaArea(SerializableMixin, Base):
    __tablename__ = "reservas_areas"

    id = Column(Integer, primary_key=True, index=True)
    area = Column(String(120), nullable=False)
    morador_nome = Column(String(120), nullable=False)
    apartamento = Column(String(50), nullable=False)
    data_reserva = Column(String(30), nullable=False)
    horario = Column(String(50), nullable=False)
    convidados = Column(Integer, nullable=False, default=0)
    status = Column(Enum(StatusReserva), nullable=False, default=StatusReserva.solicitada)
    observacao = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)
