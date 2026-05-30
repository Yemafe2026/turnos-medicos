"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

const sedes = ["Todas", "Sede Cipolletti", "Sede Neuquén", "Sede Plaza Huincul"];

const estados = [
  "Todos",
  "Pendiente de pago",
  "Confirmado",
  "Realizado",
  "Ausente",
  "No Confirmado",
  "Reprogramado",
];

const tiposTurno = ["Todos", "Carnet Profesional", "Licencia Particular"];
const mediosPagoReal = ["Transferencia", "Post Net", "Efectivo"];

function badgeEstado(estado) {
  if (estado === "Confirmado") return "bg-green-100 text-green-800 border-green-200";
  if (estado === "Realizado") return "bg-blue-100 text-blue-800 border-blue-200";
  if (estado === "Ausente") return "bg-red-100 text-red-800 border-red-200";
  if (estado === "No Confirmado") return "bg-red-100 text-red-800 border-red-200";
  if (estado === "Reprogramado") return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function esEstadoFinal(estado) {
  return ["Realizado", "Ausente", "No Confirmado", "Cancelado"].includes(estado);
}

function generarTokenReprogramacion() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatearTelefonoWhatsApp(celular) {
  const limpio = String(celular || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) return limpio;
  if (limpio.startsWith("29915")) return `54${limpio}`;
  if (limpio.startsWith("299")) return `5429915${limpio.slice(3)}`;
  if (limpio.startsWith("15")) return `54299${limpio}`;
  return limpio;
}

function formatearImporte(valor) {
  if (!valor) return "-";
  return `$${Number(valor).toLocaleString("es-AR")}`;
}

function mostrarBeneficio(turno) {
  if (
    turno.condicion_beneficio &&
    turno.condicion_beneficio !== "Ninguno de los anteriores"
  ) {
    return turno.condicion_beneficio;
  }

  return "Estándar";
}

export default function AdminPage() {
  const router = useRouter();

  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [medioPagoRealPorTurno, setMedioPagoRealPorTurno] = useState({});
  const [perfilAdmin, setPerfilAdmin] = useState(null);

  const rolAdmin = perfilAdmin?.rol || "consulta";
  const puedeGestionarPagos = ["super_admin", "admin"].includes(rolAdmin);
  const puedeGestionarAsistencia = ["super_admin", "admin", "operador"].includes(rolAdmin);

  const volverAlTurno = (id) => {
    setTimeout(() => {
      const elemento = document.getElementById(`turno-${id}`);
      if (elemento) {
        elemento.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 300);
  };

  const cargarTurnos = async () => {
    setCargando(true);

    const { data } = await supabase
      .from("turnos")
      .select("*")
      .order("fecha", { ascending: true })
      .order("horario", { ascending: true });

    setTurnos(data || []);
    setCargando(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/admin/login");
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles_admin")
        .select("rol, activo, email")
        .eq("id", data.session.user.id)
        .single();

      if (perfilError || !perfil || perfil.activo !== true) {
        await supabase.auth.signOut();
        alert("Tu usuario no tiene permisos activos para ingresar al panel.");
        router.push("/admin/login");
        return;
      }

      setPerfilAdmin(perfil);
      cargarTurnos();
    };

    init();
  }, [router]);

  const confirmarPago = async (turno) => {
    if (!puedeGestionarPagos) {
      alert("Tu usuario no tiene permisos para confirmar pagos.");
      return;
    }

    const medioPagoReal = medioPagoRealPorTurno[turno.id];

    if (turno.pagado || turno.estado === "Confirmado" || esEstadoFinal(turno.estado)) {
      return;
    }

    if (!medioPagoReal) {
      alert("Seleccione el medio real de pago antes de confirmar.");
      return;
    }

    await supabase
      .from("turnos")
      .update({
        pagado: true,
        estado: "Confirmado",
        medio_pago_real: medioPagoReal,
        comprobante_recibido: true,
        pago_confirmado_at: new Date().toISOString(),
      })
      .eq("id", turno.id);

    await fetch("/api/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telefono: formatearTelefonoWhatsApp(turno.celular),
        mensaje: `Hola ${turno.nombre}, tu turno fue CONFIRMADO.

Fecha del Turno: ${turno.fecha}
Horario del Turno: ${turno.horario}
Sede: ${turno.locacion}

Te esperamos.

Para realizar consultas, comuníquese al WhatsApp de atención: +54 9 299 5281 922.`,
      }),
    });

    await cargarTurnos();
    volverAlTurno(turno.id);
  };

  const confirmarPenalidad = async (turno) => {
    if (!puedeGestionarPagos) {
      alert("Tu usuario no tiene permisos para confirmar penalidades.");
      return;
    }

    if (!turno.penalidad_pendiente || turno.penalidad_pagada) return;

    await supabase
      .from("turnos")
      .update({
        penalidad_pagada: true,
        penalidad_pendiente: false,
        penalidad_confirmada_at: new Date().toISOString(),
        estado: "Confirmado",
      })
      .eq("id", turno.id);

    await cargarTurnos();
    volverAlTurno(turno.id);
  };

  const marcarRealizado = async (turno) => {
    if (!puedeGestionarAsistencia) {
      alert("Tu usuario no tiene permisos para modificar asistencia.");
      return;
    }

    if (turno.estado !== "Confirmado") return;

    await supabase
      .from("turnos")
      .update({
        estado: "Realizado",
        ausente: false,
      })
      .eq("id", turno.id);

    await cargarTurnos();
    volverAlTurno(turno.id);
  };

  const marcarAusente = async (turno) => {
    if (!puedeGestionarAsistencia) {
      alert("Tu usuario no tiene permisos para modificar asistencia.");
      return;
    }

    if (turno.estado !== "Confirmado") return;

    const esSegundaAusencia =
      turno.es_reprogramacion === true && turno.penalidad_pagada === true;

    if (esSegundaAusencia) {
      await supabase
        .from("turnos")
        .update({
          estado: "Ausente",
          ausente: true,
          segunda_ausencia: true,
          segunda_ausencia_at: new Date().toISOString(),
        })
        .eq("id", turno.id);

      await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telefono: formatearTelefonoWhatsApp(turno.celular),
          mensaje: `Hola ${turno.nombre}, registramos que no se presentó por segunda vez a su turno.

Para solicitar una nueva atención deberá iniciar una nueva reserva desde el comienzo y abonar la totalidad del estudio correspondiente.

Para realizar consultas, comuníquese al WhatsApp de atención: +54 9 299 5281 922.`,
        }),
      });

      await cargarTurnos();
      volverAlTurno(turno.id);
      return;
    }

    const tokenReprogramacion =
      turno.token_reprogramacion || generarTokenReprogramacion();

    await supabase
      .from("turnos")
      .update({
        estado: "Ausente",
        ausente: true,
        token_reprogramacion: tokenReprogramacion,
        penalidad_pendiente: true,
        penalidad_pagada: false,
        penalidad_porcentaje: 30,
      })
      .eq("id", turno.id);

    await fetch("/api/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telefono: formatearTelefonoWhatsApp(turno.celular),
        usarPlantilla: true,
        nombrePlantilla: "turno_ausente_reprogramar",
        idioma: "es_AR",
        variablesPlantilla: [
          turno.nombre || "-",
          turno.tipo_turno || "Carnet Profesional",
          turno.fecha || "-",
          turno.horario || "-",
          turno.locacion || "-",
        ],
        tokenBoton: tokenReprogramacion,
      }),
    });

    await cargarTurnos();
    volverAlTurno(turno.id);
  };
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const tipo = t.tipo_turno || "Carnet Profesional";

      const coincideTipo = filtroTipo === "Todos" || tipo === filtroTipo;
      const coincideEstado =
        filtroEstado === "Todos" || t.estado === filtroEstado;
      const usuarioLimitadoPorSede =
        rolAdmin === "operador" || rolAdmin === "admisionista";

      const sedePermitida = usuarioLimitadoPorSede
        ? perfilAdmin?.locacion
        : filtroSede;

      const coincideSede = usuarioLimitadoPorSede
        ? t.locacion === sedePermitida
        : filtroSede === "Todas" || t.locacion === filtroSede;
      const coincideFecha = !filtroFecha || t.fecha === filtroFecha;

      const texto = `${t.nombre || ""} ${t.dni || ""} ${t.celular || ""} ${t.locacion || ""
        } ${tipo} ${mostrarBeneficio(t)}`.toLowerCase();

      return (
        coincideTipo &&
        coincideEstado &&
        coincideSede &&
        coincideFecha &&
        texto.includes(busqueda.toLowerCase())
      );
    });
  }, [turnos, filtroEstado, filtroSede, filtroFecha, filtroTipo, busqueda]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("Todos");
    setFiltroSede("Todas");
    setFiltroFecha("");
    setFiltroTipo("Todos");
  };

  return (
    <main className="p-4 bg-slate-100 min-h-screen">
      <div className="w-full mx-auto space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Laboral Salud" className="h-12" />

            <div>
              <h1 className="text-2xl font-bold">Panel Administrativo</h1>
              <p className="text-slate-500 text-sm">
                Gestión de turnos, pagos y asistencia
              </p>
              <p className="text-xs text-slate-400">
                Rol activo: <span className="font-semibold">{rolAdmin}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={cargarTurnos}
              className="bg-white border px-4 py-2 rounded-xl text-sm hover:bg-slate-50"
            >
              Actualizar
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/admin/login");
              }}
              className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow grid md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Buscar</label>
            <input
              placeholder="Paciente, DNI, celular, sede o beneficio"
              className="border p-2 rounded-xl w-full"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border p-2 rounded-xl bg-white w-full"
            >
              {tiposTurno.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border p-2 rounded-xl bg-white w-full"
            >
              {estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>

          {rolAdmin === "operador" || rolAdmin === "admisionista" ? (
            <div>
              <label className="text-xs text-slate-500">Sede</label>
              <div className="border p-2 rounded-xl bg-slate-100 text-sm">
                {perfilAdmin?.locacion || "-"}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500">Sede</label>
              <select
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
                className="border p-2 rounded-xl bg-white w-full"
              >
                {sedes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">Fecha</label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="border p-2 rounded-xl w-full"
            />
          </div>

          <div className="md:col-span-5 flex justify-between items-center pt-1">
            <p className="text-xs text-slate-500">
              Mostrando {turnosFiltrados.length} turno
              {turnosFiltrados.length === 1 ? "" : "s"}
            </p>

            <button
              onClick={limpiarFiltros}
              className="text-xs border px-3 py-2 rounded-xl hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {cargando && (
            <div className="bg-white p-4 rounded-2xl shadow text-sm">
              Cargando...
            </div>
          )}

          {!cargando &&
            turnosFiltrados.map((t) => {
              const estadoActual = t.estado || "Pendiente de pago";
              const estaConfirmado = t.estado === "Confirmado";
              const pagoConfirmado = t.pagado || t.estado === "Confirmado";
              const finalizado = esEstadoFinal(t.estado);

              const puedeConfirmarPago =
                puedeGestionarPagos && !pagoConfirmado && !finalizado;

              const puedeConfirmarPenalidad =
                puedeGestionarPagos &&
                t.estado === "Reprogramado" &&
                t.penalidad_pendiente &&
                !t.penalidad_pagada;

              const puedeMarcarAsistencia =
                puedeGestionarAsistencia && estaConfirmado && !finalizado;

              const beneficio = mostrarBeneficio(t);
              const tieneBeneficio = beneficio !== "Estándar";

              return (
                <div
                  key={t.id}
                  id={`turno-${t.id}`}
                  className="bg-white rounded-2xl shadow border border-slate-100 p-4"
                >
                  <div className="grid grid-cols-12 gap-4 items-stretch">
                    <div className="col-span-12 md:col-span-2 border-r md:pr-4 flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
                        {(t.nombre || "?").charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">
                          {t.nombre || "-"}
                        </p>
                        <p className="text-sm text-slate-600">
                          DNI: {t.dni || "-"}
                        </p>
                        <p className="text-sm text-blue-700">
                          {t.celular || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-2 border-r md:pr-4 space-y-1 text-sm">
                      <p>
                        <span className="font-semibold">Tipo:</span>{" "}
                        {t.tipo_turno || "Carnet Profesional"}
                      </p>
                      <p>
                        <span className="font-semibold">Sede:</span>{" "}
                        {t.locacion || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Fecha:</span>{" "}
                        {t.fecha || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Hora:</span>{" "}
                        {t.horario || "-"}
                      </p>
                    </div>

                    <div className="col-span-12 md:col-span-2 border-r md:pr-4 space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Estado</p>
                        <span
                          className={`inline-block px-3 py-1 rounded-full border text-xs font-semibold ${badgeEstado(
                            estadoActual
                          )}`}
                        >
                          {estadoActual}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Pago</p>
                        {pagoConfirmado ? (
                          <span className="text-green-700 font-semibold">
                            Pagado
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold">
                            No pagado
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Método elegido
                        </p>
                        <p className="font-semibold">
                          {t.metodo_pago || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Medio real</p>

                        {t.medio_pago_real ? (
                          <p className="text-green-700 font-semibold">
                            {t.medio_pago_real}
                          </p>
                        ) : puedeConfirmarPago ? (
                          <select
                            className="border rounded-xl p-2 text-xs bg-white w-full"
                            value={medioPagoRealPorTurno[t.id] || ""}
                            onChange={(e) =>
                              setMedioPagoRealPorTurno({
                                ...medioPagoRealPorTurno,
                                [t.id]: e.target.value,
                              })
                            }
                          >
                            <option value="">Seleccionar</option>

                            {mediosPagoReal.map((medio) => (
                              <option key={medio} value={medio}>
                                {medio}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-2 border-r md:pr-4 space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Beneficio</p>

                        {tieneBeneficio ? (
                          <p className="text-purple-700 font-bold">
                            {beneficio}
                          </p>
                        ) : (
                          <p className="font-semibold text-slate-700">
                            Estándar
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Importe</p>

                        <p className="text-xl font-bold">
                          {formatearImporte(t.importe_servicio)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Penalidad</p>

                        {t.penalidad_pendiente && !t.penalidad_pagada ? (
                          <span className="text-red-700 font-semibold">
                            30% pendiente
                          </span>
                        ) : t.penalidad_pagada ? (
                          <span className="text-green-700 font-semibold">
                            Penalidad pagada
                          </span>
                        ) : (
                          <span className="text-slate-400">-
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-2 border-r md:pr-4 flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => confirmarPago(t)}
                        disabled={!puedeConfirmarPago}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold ${pagoConfirmado
                          ? "bg-green-100 text-green-800 cursor-not-allowed"
                          : puedeConfirmarPago
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed"
                          }`}
                      >
                        {pagoConfirmado
                          ? "Pago confirmado"
                          : "Confirmar pago"}
                      </button>

                      <button
                        onClick={() => confirmarPenalidad(t)}
                        disabled={!puedeConfirmarPenalidad}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold ${puedeConfirmarPenalidad
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-purple-100 text-purple-300 cursor-not-allowed"
                          }`}
                      >
                        {t.penalidad_pagada
                          ? "Penalidad pagada"
                          : "Confirmar penalidad"}
                      </button>
                    </div>

                    <div className="col-span-12 md:col-span-2 flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => marcarRealizado(t)}
                        disabled={!puedeMarcarAsistencia}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold ${t.estado === "Realizado"
                          ? "bg-blue-100 text-blue-800 cursor-not-allowed"
                          : puedeMarcarAsistencia
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                      >
                        {t.estado === "Realizado"
                          ? "✔ Se presentó"
                          : "Se presentó"}
                      </button>

                      <button
                        onClick={() => marcarAusente(t)}
                        disabled={!puedeMarcarAsistencia}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold ${t.estado === "Ausente"
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : puedeMarcarAsistencia
                            ? "bg-slate-800 hover:bg-slate-900 text-white"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                      >
                        {t.estado === "Ausente"
                          ? "✔ Ausente"
                          : "No se presentó"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

          {!cargando && turnosFiltrados.length === 0 && (
            <div className="bg-white p-6 rounded-2xl shadow text-sm text-slate-500">
              No hay turnos para los filtros seleccionados.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}