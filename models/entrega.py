import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text

from database.db import Base
from utils.timezone import local_now


class StatusEntrega(enum.Enum):
    pendente = "pendente"
    entregue = "entregue"
    cancelada = "cancelada"


class Entrega(Base):
    __tablename__ = "entregas"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String(255), nullable=False)
    apartamento = Column(String(50), nullable=False)
    morador_nome = Column(String(120), nullable=False)
    recebedor_nome = Column(String(120), nullable=False, default="Portaria")
    observacao = Column(Text, nullable=True)
    status = Column(Enum(StatusEntrega), default=StatusEntrega.pendente, nullable=False)
    data_recebimento = Column(DateTime, nullable=False, default=local_now)
    data_entrega = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=local_now)
    updated_at = Column(DateTime, nullable=False, default=local_now, onupdate=local_now)

    def to_dict(self):
        return {
            "id": self.id,
            "descricao": self.descricao,
            "apartamento": self.apartamento,
            "morador_nome": self.morador_nome,
            "recebedor_nome": self.recebedor_nome,
            "observacao": self.observacao,
            "status": self.status.value if self.status else None,
            "data_recebimento": self.data_recebimento.isoformat() if self.data_recebimento else None,
            "data_entrega": self.data_entrega.isoformat() if self.data_entrega else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
