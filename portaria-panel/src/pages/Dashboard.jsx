/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";

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
  entregas: {
    descricao: "",
    apartamento: "",
    morador_nome: "",
    recebedor_nome: "Portaria",
    qr_code: "",
    codigo_barras: "",
    foto_url: "",
    observacao: "",
  },
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

const barcodeFormats = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
];

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

function PackagePhoto({ src, alt }) {
  if (!src) return null;
  return <img className="package-photo" src={src} alt={alt} />;
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

function ScannerSupportHint() {
  const hasBarcodeDetector = typeof BarcodeDetector !== "undefined";

  return (
    <p className="camera-hint">
      {hasBarcodeDetector
        ? "Leitura automatica disponivel. Se a camera ao vivo falhar, use a leitura por imagem."
        : "Este navegador pode nao ler QR code ou codigo de barras ao vivo. Prefira a opcao por imagem."}
    </p>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraMode, setCameraMode] = useState(null);
  const [cameraError, setCameraError] = useState("");
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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const photoInputRef = useRef(null);
  const qrInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

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

  function clearDeliveryField(field, successMessage) {
    updateForm("entregas", field, "");
    setMessage(successMessage);
  }

  function stopCamera() {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraMode(null);
  }

  async function detectCodeFromSource(source, mode) {
    if (typeof BarcodeDetector === "undefined") {
      throw new Error("Leitura automatica nao suportada neste navegador.");
    }

    const detector = new BarcodeDetector({ formats: barcodeFormats });
    const codes = await detector.detect(source);

    if (!codes.length) {
      throw new Error(mode === "qr" ? "Nenhum QR code encontrado na imagem." : "Nenhum codigo de barras encontrado na imagem.");
    }

    const rawValue = codes[0].rawValue || "";
    if (mode === "qr") {
      updateForm("entregas", "qr_code", rawValue);
      setMessage("QR code lido com sucesso.");
    } else {
      updateForm("entregas", "codigo_barras", rawValue);
      setMessage("Codigo de barras lido com sucesso.");
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem selecionada."));
      image.src = dataUrl;
    });
  }

  useEffect(() => stopCamera, []);

  async function startCamera(mode) {
    stopCamera();
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador nao permite acesso a camera.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraMode(mode);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (mode !== "foto") {
        startScanLoop(mode);
      }
    } catch (error) {
      console.error(error);
      setCameraError("Nao foi possivel abrir a camera. Verifique permissao do navegador e use localhost ou HTTPS.");
      stopCamera();
    }
  }

  async function startScanLoop(mode) {
    if (typeof BarcodeDetector === "undefined") {
      setCameraError("Leitura automatica nao suportada neste navegador. Digite o codigo manualmente.");
      return;
    }

    try {
      const detector = new BarcodeDetector({ formats: barcodeFormats });

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }

                        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const rawValue = codes[0].rawValue || "";
            if (mode === "qr") {
              updateForm("entregas", "qr_code", rawValue);
              setMessage("QR code lido com sucesso.");
            } else {
              updateForm("entregas", "codigo_barras", rawValue);
              setMessage("Codigo de barras lido com sucesso.");
            }
            stopCamera();
            return;
          }
        } catch (error) {
          console.error(error);
          setCameraError("Nao foi possivel ler o codigo automaticamente.");
          stopCamera();
          return;
        }

        scanFrameRef.current = requestAnimationFrame(scan);
      };

      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (error) {
      console.error(error);
      setCameraError("Detector de codigo indisponivel neste dispositivo.");
    }
  }

  function capturePackagePhoto() {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera nao inicializada para captura.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    updateForm("entregas", "foto_url", canvas.toDataURL("image/jpeg", 0.92));
    setMessage("Foto da encomenda capturada com sucesso.");
    stopCamera();
  }

  async function handleImageSelection(event, mode) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);

      if (mode === "foto") {
        updateForm("entregas", "foto_url", dataUrl);
        setMessage("Foto da encomenda carregada com sucesso.");
        return;
      }

      const image = await loadImage(dataUrl);
      await detectCodeFromSource(image, mode);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Nao foi possivel processar a imagem.");
    }
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
                  <input placeholder="QR code" value={forms.entregas.qr_code} onChange={(event) => updateForm("entregas", "qr_code", event.target.value)} />
                  <input placeholder="Codigo de barras" value={forms.entregas.codigo_barras} onChange={(event) => updateForm("entregas", "codigo_barras", event.target.value)} />
                  <input className="span-2" placeholder="Foto da encomenda (URL ou base64)" value={forms.entregas.foto_url} onChange={(event) => updateForm("entregas", "foto_url", event.target.value)} />
                  <input className="span-2" placeholder="Observacao" value={forms.entregas.observacao} onChange={(event) => updateForm("entregas", "observacao", event.target.value)} />
                </div>
                <div className="camera-actions">
                  <button className="secondary-button" type="button" onClick={() => startCamera("qr")} disabled={saving}>
                    Ler QR code
                  </button>
                  <button className="ghost-button" type="button" onClick={() => qrInputRef.current?.click()} disabled={saving}>
                    Ler QR por imagem
                  </button>
                  <button className="secondary-button" type="button" onClick={() => startCamera("barcode")} disabled={saving}>
                    Ler codigo de barras
                  </button>
                  <button className="ghost-button" type="button" onClick={() => barcodeInputRef.current?.click()} disabled={saving}>
                    Ler barras por imagem
                  </button>
                  <button className="secondary-button" type="button" onClick={() => startCamera("foto")} disabled={saving}>
                    Tirar foto
                  </button>
                  <button className="ghost-button" type="button" onClick={() => photoInputRef.current?.click()} disabled={saving}>
                    Carregar foto
                  </button>
                </div>
                <ScannerSupportHint />
                <div className="camera-actions compact">
                  <button className="ghost-button" type="button" onClick={() => clearDeliveryField("qr_code", "QR code removido.")} disabled={saving || !forms.entregas.qr_code}>
                    Limpar QR
                  </button>
                  <button className="ghost-button" type="button" onClick={() => clearDeliveryField("codigo_barras", "Codigo de barras removido.")} disabled={saving || !forms.entregas.codigo_barras}>
                    Limpar barras
                  </button>
                  <button className="ghost-button" type="button" onClick={() => clearDeliveryField("foto_url", "Foto removida da entrega.")} disabled={saving || !forms.entregas.foto_url}>
                    Limpar foto
                  </button>
                </div>
                <input
                  ref={qrInputRef}
                  className="hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleImageSelection(event, "qr")}
                />
                <input
                  ref={barcodeInputRef}
                  className="hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleImageSelection(event, "barcode")}
                />
                <input
                  ref={photoInputRef}
                  className="hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleImageSelection(event, "foto")}
                />
                {(cameraMode || cameraError) && (
                  <div className="camera-panel">
                    {cameraMode ? (
                      <>
                        <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="camera-canvas" />
                        <p className="camera-hint">
                          {cameraMode === "foto"
                            ? "Posicione a encomenda e clique em capturar."
                            : cameraMode === "qr"
                              ? "Aponte a camera para o QR code."
                              : "Aponte a camera para o codigo de barras."}
                        </p>
                        <div className="card-actions">
                          {cameraMode === "foto" && (
                            <button className="primary-button" type="button" onClick={capturePackagePhoto}>
                              Capturar foto
                            </button>
                          )}
                          <button className="ghost-button" type="button" onClick={stopCamera}>
                            Fechar camera
                          </button>
                        </div>
                      </>
                    ) : null}
                    {cameraError ? <p className="camera-error">{cameraError}</p> : null}
                  </div>
                )}
                <PackagePhoto src={forms.entregas.foto_url} alt="Preview da foto da encomenda em cadastro" />
                <button className="primary-button" type="submit" disabled={saving}>Registrar entrega</button>
              </form>

              <div className="content-card list-card">
                <SectionHeader eyebrow="Pacotes" title="Controle de entregas" description="Marque a retirada conforme a operacao da portaria." />
                <div className="data-grid">
                  {data.entregas.map((item) => (
                    <article className="data-card" key={item.id}>
                      <PackagePhoto src={item.foto_url} alt={`Foto da encomenda ${item.descricao}`} />
                      <div className="card-topline">
                        <strong>{item.descricao}</strong>
                        <StatusBadge tone={item.status === "entregue" ? "green" : item.status === "cancelada" ? "red" : "amber"}>{item.status}</StatusBadge>
                      </div>
                      <p>{item.morador_nome} · Apto {item.apartamento}</p>
                      <p>Recebido por {item.recebedor_nome}</p>
                      <p>QR code: {emptyValue(item.qr_code)}</p>
                      <p>Codigo de barras: {emptyValue(item.codigo_barras)}</p>
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
