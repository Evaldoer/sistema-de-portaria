import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Dashboard() {
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Buscar entregas
  async function carregarEntregas() {
    try {
      setLoading(true);
      const response = await api.get("/entregas/");
      setEntregas(response.data);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  }

  // 🔹 Atualizar status (COM DEBUG)
  async function marcarComoEntregue(id) {
    console.log("clicou botão ID:", id); // 👈 DEBUG

    try {
      const response = await api.put(`/entregas/${id}`, {
        status: "entregue"
      });

      console.log("RESPOSTA PUT:", response); // 👈 DEBUG

      await carregarEntregas();
    } catch (error) {
      console.error("ERRO AO ATUALIZAR:", error); // 👈 DEBUG
    }
  }

  // 🔹 useEffect (ok)
  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const response = await api.get("/entregas/");
        if (mounted) {
          setEntregas(response.data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro ao carregar:", error);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>📦 Sistema de Portaria</h1>

      <button onClick={carregarEntregas}>
        Atualizar
      </button>

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p>Carregando...</p>
        ) : entregas.length === 0 ? (
          <p>Nenhuma entrega cadastrada</p>
        ) : (
          entregas.map((e) => (
            <div
              key={e.id}
              style={{
                border: "1px solid #ccc",
                padding: 12,
                borderRadius: 8,
                marginBottom: 10
              }}
            >
              <strong>Apartamento:</strong> {e.apartamento} <br />
              <strong>Descrição:</strong> {e.descricao} <br />
              <strong>Status:</strong> {e.status} <br /><br />

              {e.status !== "entregue" && (
                <button
                  onClick={() => {
                    alert("clicou botão"); // 👈 TESTE VISUAL
                    marcarComoEntregue(e.id);
                  }}
                >
                  Marcar como entregue
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}