import { useEffect, useState } from "react";

import { api } from "../services/api";
import "../App.css";

const tabs = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "moradores", label: "Moradores" },
  { id: "visitantes", label: "Visitantes" },
  { id: "veiculos", label: "Veiculos" },
  { id: "entregas", label: "Entregas" },
  { id: "ocorrencias", label: "Ocorrencias" },
  { id: "reservas", label: "Reservas" },
];

const initialForms = {
  moradores: { nome: "", apartamento: "", telefone: "", email: "", bloco: "", observacao: "" },
  visitantes: { nome: "", documento: "", morador_nome: "", apartamento: "", motivo: "", status: "autorizado", observacao: "" },
  veiculos: { placa: "", modelo: "", cor: "", morador_nome: "", apartamento: "", tipo: "carro", vaga: "", observacao: "" },
  entregas: { descricao: "", apartamento: "", morador_nome: "", recebedor_nome: "Portaria", observacao: "" },
  ocorrencias: { titulo: "", categoria: "", local: "", prioridade: "media", responsavel: "", status: "aberta", descricao: "" },
  reservas: { area: "", morador_nome: "", apartamento: "", data_reserva: "", horario: "", convidados: 0, status: "solicitada", observacao: "" },
};

const endpoints = {
  resumo: "/api/dashboard/resumo",
  moradores: "/api/moradores",
  visitantes: "/api/visitantes",
  veiculos: "/api/veiculos",
  entregas: "/entregas/",
  ocorrencias: "/api/ocorrencias",
  reservas: "/api/reservas",
};

function resourceUrl(section, id = null) {
  const base = endpoints[section].replace(/\/$/, "");
  return id === null ? base : `${base}/${id}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function emptyValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="section-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState({
    resumo: { metricas: {}, recentes: { visitantes: [], ocorrencias: [], entregas: [] } },
    moradores: [],
    visitantes: [],
    veiculos: [],
    entregas: [],
    ocorrencias: [],
    reservas: [],
  });
  const [forms, setForms] = useState(initialForms);

  async function loadData() {
    setLoading(true);
    try {
      const [resumo, moradores, visitantes, veiculos, entregas, ocorrencias, reservas] = await Promise.all([
        api.get(endpoints.resumo),
        api.get(endpoints.moradores),
        api.get(endpoints.visitantes),
        api.get(endpoints.veiculos),
        api.get(resourceUrl("entregas")),
        api.get(endpoints.ocorrencias),
        api.get(endpoints.reservas),
      ]);

      setData({
        resumo: resumo.data,
        moradores: moradores.data,
        visitantes: visitantes.data,
        veiculos: veiculos.data,
        entregas: entregas.data,
        ocorrencias: ocorrencias.data,
        reservas: reservas.data,
      });
    } catch (error) {
      console.error(error);
      setMessage("Nao foi possivel carregar a base da portaria.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateForm(section, field, value) {
    setForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  async function handleCreate(section, event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await api.post(endpoints[section], forms[section]);
      setForms((current) => ({ ...current, [section]: initialForms[section] }));
      setMessage("Registro salvo com sucesso.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.erro || "Nao foi possivel salvar o registro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(section, id) {
    setSaving(true);
    setMessage("");
    try {
      await api.delete(resourceUrl(section, id));
      setMessage("Registro removido com sucesso.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Nao foi possivel remover o registro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(section, id, payload) {
    setSaving(true);
    setMessage("");
    try {
      await api.put(resourceUrl(section, id), payload);
      setMessage("Status atualizado com sucesso.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.erro || "Nao foi possivel atualizar o status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed() {
    setSaving(true);
    setMessage("");
    try {
      await api.post("/api/seed");
      setMessage("Base inicial carregada para demonstracao.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Nao foi possivel criar a base inicial.");
    } finally {
      setSaving(false);
    }
  }

  const metricCards = [
    { label: "Moradores ativos", value: data.resumo.metricas.moradores || 0, tone: "blue" },
    { label: "Visitantes em visita", value: data.resumo.metricas.visitantes_ativos || 0, tone: "green" },
    { label: "Entregas pendentes", value: data.resumo.metricas.entregas_pendentes || 0, tone: "amber" },
    { label: "Ocorrencias abertas", value: data.resumo.metricas.ocorrencias_abertas || 0, tone: "red" },
    { label: "Reservas confirmadas", value: data.resumo.metricas.reservas_confirmadas || 0, tone: "slate" },
  ];

  return (
    <div className="portaria-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Operacao da portaria</span>
          <h1>Central completa para controle do condominio</h1>
          <p>
            Cadastre moradores, gerencie visitantes, acompanhe entregas, monitore
            ocorrencias e organize reservas em um unico painel operacional.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={loadData} disabled={loading || saving}>
              Atualizar painel
            </button>
            <button className="secondary-button" onClick={handleSeed} disabled={saving}>
              Popular com dados iniciais
            </button>
          </div>
        </div>

        <div className="hero-highlight">
          <div className="highlight-card">
            <span>Turno atual</span>
            <strong>Portaria em operacao</strong>
            <p>{loading ? "Sincronizando dados..." : "Todos os modulos disponiveis para uso."}</p>
          </div>
          <div className="highlight-grid">
            {metricCards.slice(0, 4).map((item) => (
              <article className={`mini-metric ${item.tone}`} key={item.label}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {message ? <div className="feedback-banner">{message}</div> : null}

      {loading ? (
        <section className="content-card loading-card">
          <p>Carregando modulos da portaria...</p>
        </section>
      ) : (
        <>
          {activeTab === "visao-geral" && (
            <section className="dashboard-grid">
              <div className="content-card">
                <SectionHeader
                  eyebrow="Resumo"
                  title="Indicadores do turno"
                  description="Visao rapida dos pontos que merecem atencao da equipe."
                />
                <div className="metrics-grid">
                  {metricCards.map((item) => (
                    <article className={`metric-card ${item.tone}`} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </article>
                  ))}
                </div>
              </div>

              <div className="content-card">
                <SectionHeader
                  eyebrow="Movimento recente"
                  title="Ultimos visitantes"
                  description="Acompanhe entradas e autorizacoes mais recentes."
                />
                <div className="list-stack">
                  {data.resumo.recentes.visitantes.length === 0 ? (
                    <p className="empty-state">Nenhum visitante registrado.</p>
                  ) : (
                    data.resumo.recentes.visitantes.map((item) => (
                      <article key={item.id} className="timeline-item">
                        <div>
                          <strong>{item.nome}</strong>
                          <p>{item.apartamento} · {item.motivo}</p>
                        </div>
                        <StatusBadge tone={item.status === "em_visita" ? "green" : "amber"}>{item.status}</StatusBadge>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="content-card">
                <SectionHeader
                  eyebrow="Atencao"
                  title="Ocorrencias recentes"
                  description="Aberturas e tratativas que impactam a rotina do condominio."
                />
                <div className="list-stack">
                  {data.resumo.recentes.ocorrencias.length === 0 ? (
                    <p className="empty-state">Nenhuma ocorrencia recente.</p>
                  ) : (
                    data.resumo.recentes.ocorrencias.map((item) => (
                      <article key={item.id} className="timeline-item">
                        <div>
                          <strong>{item.titulo}</strong>
                          <p>{item.local} · {item.prioridade}</p>
                        </div>
                        <StatusBadge tone={item.status === "resolvida" ? "green" : "red"}>{item.status}</StatusBadge>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="content-card">
                <SectionHeader
                  eyebrow="Recebimentos"
                  title="Entregas em destaque"
                  description="Pacotes aguardando retirada e entregas recentes."
                />
                <div className="list-stack">
                  {data.resumo.recentes.entregas.length === 0 ? (
                    <p className="empty-state">Nenhuma entrega cadastrada.</p>
                  ) : (
                    data.resumo.recentes.entregas.map((item) => (
                      <article key={item.id} className="timeline-item">
                        <div>
                          <strong>{item.descricao}</strong>
                          <p>{item.apartamento} · {item.morador_nome}</p>
                        </div>
                        <StatusBadge tone={item.status === "entregue" ? "green" : "amber"}>{item.status}</StatusBadge>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === "moradores" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("moradores", event)}>
                <SectionHeader eyebrow="Cadastro" title="Novo morador" description="Registre unidade, contato e observacoes principais." />
                <div className="form-grid">
                  <input placeholder="Nome" value={forms.moradores.nome} onChange={(event) => updateForm("moradores", "nome", event.target.value)} />
                  <input placeholder="Apartamento" value={forms.moradores.apartamento} onChange={(event) => updateForm("moradores", "apartamento", event.target.value)} />
                  <input placeholder="Telefone" value={forms.moradores.telefone} onChange={(event) => updateForm("moradores", "telefone", event.target.value)} />
                  <input placeholder="Email" value={forms.moradores.email} onChange={(event) => updateForm("moradores", "email", event.target.value)} />
                  <input placeholder="Bloco" value={forms.moradores.bloco} onChange={(event) => updateForm("moradores", "bloco", event.target.value)} />
                  <input placeholder="Observacao" value={forms.moradores.observacao} onChange={(event) => updateForm("moradores", "observacao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Salvar morador</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Unidades" title="Moradores cadastrados" description="Lista operacional para consulta rapida da portaria." />
                <div className="data-grid">
                  {data.moradores.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.nome}</strong>
                        <StatusBadge tone={item.ativo ? "green" : "red"}>{item.ativo ? "ativo" : "inativo"}</StatusBadge>
                      </div>
                      <p>Apto {item.apartamento} · Bloco {emptyValue(item.bloco)}</p>
                      <p>{item.telefone} · {emptyValue(item.email)}</p>
                      <p>{emptyValue(item.observacao)}</p>
                      <div className="card-actions">
                        <button className="ghost-button" onClick={() => handleDelete("moradores", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "visitantes" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("visitantes", event)}>
                <SectionHeader eyebrow="Controle de acesso" title="Novo visitante" description="Autorize, registre entrada ou finalize a visita." />
                <div className="form-grid">
                  <input placeholder="Nome" value={forms.visitantes.nome} onChange={(event) => updateForm("visitantes", "nome", event.target.value)} />
                  <input placeholder="Documento" value={forms.visitantes.documento} onChange={(event) => updateForm("visitantes", "documento", event.target.value)} />
                  <input placeholder="Morador responsavel" value={forms.visitantes.morador_nome} onChange={(event) => updateForm("visitantes", "morador_nome", event.target.value)} />
                  <input placeholder="Apartamento" value={forms.visitantes.apartamento} onChange={(event) => updateForm("visitantes", "apartamento", event.target.value)} />
                  <input placeholder="Motivo da visita" value={forms.visitantes.motivo} onChange={(event) => updateForm("visitantes", "motivo", event.target.value)} />
                  <select value={forms.visitantes.status} onChange={(event) => updateForm("visitantes", "status", event.target.value)}>
                    <option value="autorizado">Autorizado</option>
                    <option value="em_visita">Em visita</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                  <input className="span-2" placeholder="Observacao" value={forms.visitantes.observacao} onChange={(event) => updateForm("visitantes", "observacao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Registrar visitante</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Fluxo de pessoas" title="Visitantes recentes" description="Atualize rapidamente a situacao de acesso." />
                <div className="data-grid">
                  {data.visitantes.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.nome}</strong>
                        <StatusBadge tone={item.status === "em_visita" ? "green" : item.status === "finalizado" ? "slate" : "amber"}>{item.status}</StatusBadge>
                      </div>
                      <p>{item.documento} · Apto {item.apartamento}</p>
                      <p>{item.morador_nome} · {item.motivo}</p>
                      <p>Entrada: {formatDate(item.entrada_em)} · Saida: {formatDate(item.saida_em)}</p>
                      <div className="card-actions">
                        {item.status !== "em_visita" && (
                          <button className="ghost-button" onClick={() => handleStatus("visitantes", item.id, { status: "em_visita" })}>Marcar entrada</button>
                        )}
                        {item.status !== "finalizado" && (
                          <button className="ghost-button" onClick={() => handleStatus("visitantes", item.id, { status: "finalizado" })}>Finalizar</button>
                        )}
                        <button className="ghost-button danger" onClick={() => handleDelete("visitantes", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "veiculos" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("veiculos", event)}>
                <SectionHeader eyebrow="Cadastro veicular" title="Novo veiculo" description="Mantenha placas e vagas vinculadas aos moradores." />
                <div className="form-grid">
                  <input placeholder="Placa" value={forms.veiculos.placa} onChange={(event) => updateForm("veiculos", "placa", event.target.value)} />
                  <input placeholder="Modelo" value={forms.veiculos.modelo} onChange={(event) => updateForm("veiculos", "modelo", event.target.value)} />
                  <input placeholder="Cor" value={forms.veiculos.cor} onChange={(event) => updateForm("veiculos", "cor", event.target.value)} />
                  <input placeholder="Morador" value={forms.veiculos.morador_nome} onChange={(event) => updateForm("veiculos", "morador_nome", event.target.value)} />
                  <input placeholder="Apartamento" value={forms.veiculos.apartamento} onChange={(event) => updateForm("veiculos", "apartamento", event.target.value)} />
                  <select value={forms.veiculos.tipo} onChange={(event) => updateForm("veiculos", "tipo", event.target.value)}>
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                    <option value="utilitario">Utilitario</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input placeholder="Vaga" value={forms.veiculos.vaga} onChange={(event) => updateForm("veiculos", "vaga", event.target.value)} />
                  <input placeholder="Observacao" value={forms.veiculos.observacao} onChange={(event) => updateForm("veiculos", "observacao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Salvar veiculo</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Controle" title="Veiculos identificados" description="Consulta rapida de placas, moradores e vagas." />
                <div className="data-grid">
                  {data.veiculos.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.placa}</strong>
                        <StatusBadge tone="blue">{item.tipo}</StatusBadge>
                      </div>
                      <p>{item.modelo} · {item.cor}</p>
                      <p>{item.morador_nome} · Apto {item.apartamento}</p>
                      <p>Vaga {emptyValue(item.vaga)}</p>
                      <div className="card-actions">
                        <button className="ghost-button danger" onClick={() => handleDelete("veiculos", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "entregas" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("entregas", event)}>
                <SectionHeader eyebrow="Recebimento" title="Nova entrega" description="Registre pacotes recebidos e acompanhe retirada pelos moradores." />
                <div className="form-grid">
                  <input placeholder="Descricao da entrega" value={forms.entregas.descricao} onChange={(event) => updateForm("entregas", "descricao", event.target.value)} />
                  <input placeholder="Apartamento" value={forms.entregas.apartamento} onChange={(event) => updateForm("entregas", "apartamento", event.target.value)} />
                  <input placeholder="Morador" value={forms.entregas.morador_nome} onChange={(event) => updateForm("entregas", "morador_nome", event.target.value)} />
                  <input placeholder="Recebido por" value={forms.entregas.recebedor_nome} onChange={(event) => updateForm("entregas", "recebedor_nome", event.target.value)} />
                  <input className="span-2" placeholder="Observacao" value={forms.entregas.observacao} onChange={(event) => updateForm("entregas", "observacao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Registrar entrega</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Pacotes" title="Controle de entregas" description="Marque a retirada conforme a operacao da portaria." />
                <div className="data-grid">
                  {data.entregas.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.descricao}</strong>
                        <StatusBadge tone={item.status === "entregue" ? "green" : item.status === "cancelada" ? "red" : "amber"}>{item.status}</StatusBadge>
                      </div>
                      <p>{item.morador_nome} · Apto {item.apartamento}</p>
                      <p>Recebido por {item.recebedor_nome}</p>
                      <p>Entrada: {formatDate(item.data_recebimento)}</p>
                      <div className="card-actions">
                        {item.status !== "entregue" && (
                          <button className="ghost-button" onClick={() => handleStatus("entregas", item.id, { status: "entregue" })}>Marcar entregue</button>
                        )}
                        {item.status !== "cancelada" && (
                          <button className="ghost-button" onClick={() => handleStatus("entregas", item.id, { status: "cancelada" })}>Cancelar</button>
                        )}
                        <button className="ghost-button danger" onClick={() => handleDelete("entregas", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "ocorrencias" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("ocorrencias", event)}>
                <SectionHeader eyebrow="Registro interno" title="Nova ocorrencia" description="Formalize incidentes, prioridades e responsaveis." />
                <div className="form-grid">
                  <input placeholder="Titulo" value={forms.ocorrencias.titulo} onChange={(event) => updateForm("ocorrencias", "titulo", event.target.value)} />
                  <input placeholder="Categoria" value={forms.ocorrencias.categoria} onChange={(event) => updateForm("ocorrencias", "categoria", event.target.value)} />
                  <input placeholder="Local" value={forms.ocorrencias.local} onChange={(event) => updateForm("ocorrencias", "local", event.target.value)} />
                  <input placeholder="Responsavel" value={forms.ocorrencias.responsavel} onChange={(event) => updateForm("ocorrencias", "responsavel", event.target.value)} />
                  <select value={forms.ocorrencias.prioridade} onChange={(event) => updateForm("ocorrencias", "prioridade", event.target.value)}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                  <select value={forms.ocorrencias.status} onChange={(event) => updateForm("ocorrencias", "status", event.target.value)}>
                    <option value="aberta">Aberta</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="resolvida">Resolvida</option>
                  </select>
                  <textarea className="span-2" placeholder="Descricao" value={forms.ocorrencias.descricao} onChange={(event) => updateForm("ocorrencias", "descricao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Salvar ocorrencia</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Monitoramento" title="Ocorrencias cadastradas" description="Acompanhe o tratamento e encerre os casos resolvidos." />
                <div className="data-grid">
                  {data.ocorrencias.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.titulo}</strong>
                        <StatusBadge tone={item.status === "resolvida" ? "green" : "red"}>{item.status}</StatusBadge>
                      </div>
                      <p>{item.categoria} · {item.local}</p>
                      <p>Prioridade {item.prioridade} · {item.responsavel}</p>
                      <p>{item.descricao}</p>
                      <div className="card-actions">
                        {item.status !== "em_andamento" && (
                          <button className="ghost-button" onClick={() => handleStatus("ocorrencias", item.id, { status: "em_andamento" })}>Em andamento</button>
                        )}
                        {item.status !== "resolvida" && (
                          <button className="ghost-button" onClick={() => handleStatus("ocorrencias", item.id, { status: "resolvida" })}>Resolver</button>
                        )}
                        <button className="ghost-button danger" onClick={() => handleDelete("ocorrencias", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "reservas" && (
            <section className="module-layout">
              <form className="content-card form-card" onSubmit={(event) => handleCreate("reservas", event)}>
                <SectionHeader eyebrow="Areas comuns" title="Nova reserva" description="Organize uso de espacos compartilhados com status de aprovacao." />
                <div className="form-grid">
                  <input placeholder="Area" value={forms.reservas.area} onChange={(event) => updateForm("reservas", "area", event.target.value)} />
                  <input placeholder="Morador" value={forms.reservas.morador_nome} onChange={(event) => updateForm("reservas", "morador_nome", event.target.value)} />
                  <input placeholder="Apartamento" value={forms.reservas.apartamento} onChange={(event) => updateForm("reservas", "apartamento", event.target.value)} />
                  <input type="date" value={forms.reservas.data_reserva} onChange={(event) => updateForm("reservas", "data_reserva", event.target.value)} />
                  <input placeholder="Horario" value={forms.reservas.horario} onChange={(event) => updateForm("reservas", "horario", event.target.value)} />
                  <input type="number" min="0" placeholder="Convidados" value={forms.reservas.convidados} onChange={(event) => updateForm("reservas", "convidados", event.target.value)} />
                  <select value={forms.reservas.status} onChange={(event) => updateForm("reservas", "status", event.target.value)}>
                    <option value="solicitada">Solicitada</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <input placeholder="Observacao" value={forms.reservas.observacao} onChange={(event) => updateForm("reservas", "observacao", event.target.value)} />
                </div>
                <button className="primary-button" type="submit" disabled={saving}>Salvar reserva</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Agenda" title="Reservas programadas" description="Confirme solicitacoes e mantenha a agenda das areas atualizada." />
                <div className="data-grid">
                  {data.reservas.map((item) => (
                    <article className="data-card" key={item.id}>
                      <div className="card-topline">
                        <strong>{item.area}</strong>
                        <StatusBadge tone={item.status === "confirmada" ? "green" : item.status === "cancelada" ? "red" : "amber"}>{item.status}</StatusBadge>
                      </div>
                      <p>{item.morador_nome} · Apto {item.apartamento}</p>
                      <p>{item.data_reserva} · {item.horario}</p>
                      <p>{item.convidados} convidados</p>
                      <div className="card-actions">
                        {item.status !== "confirmada" && (
                          <button className="ghost-button" onClick={() => handleStatus("reservas", item.id, { status: "confirmada" })}>Confirmar</button>
                        )}
                        {item.status !== "cancelada" && (
                          <button className="ghost-button" onClick={() => handleStatus("reservas", item.id, { status: "cancelada" })}>Cancelar</button>
                        )}
                        <button className="ghost-button danger" onClick={() => handleDelete("reservas", item.id)}>Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
