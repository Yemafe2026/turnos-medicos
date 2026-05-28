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
  if (estado === "Confirmado") return "bg-green-100 text-green-800";
  if (estado === "Realizado") return "bg-blue-100 text-blue-800";
  if (estado === "Ausente") return "bg-slate-200 text-slate-800";
  if (estado === "No Confirmado") return "bg-red-100 text-red-800";
  if (estado === "Reprogramado") return "bg-purple-100 text-purple-800";
  return "bg-amber-100 text-amber-800";
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

      cargarTurnos();
    };

    init();
  }, [router]);

  const confirmarPago = async (turno) => {
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

    cargarTurnos();
  };

  const confirmarPenalidad = async (turno) => {
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

    cargarTurnos();
  };

  const marcarRealizado = async (turno) => {
    if (turno.estado !== "Confirmado") return;

    await supabase
      .from("turnos")
      .update({
        estado: "Realizado",
        ausente: false,
      })
      .eq("id", turno.id);

    cargarTurnos();
  };

  const marcarAusente = async (turno) => {
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

      cargarTurnos();
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

    cargarTurnos();
  };

  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const tipo = t.tipo_turno || "Carnet Profesional";

      const coincideTipo = filtroTipo === "Todos" || tipo === filtroTipo;
      const coincideEstado =
        filtroEstado === "Todos" || t.estado === filtroEstado;
      const coincideSede = filtroSede === "Todas" || t.locacion === filtroSede;
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

  return (
    <main className="p-6 bg-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Laboral Salud" className="h-14" />

            <div>
              <h1 className="text-2xl font-bold">Panel Administrativo</h1>
              <p className="text-slate-500 text-sm">
                Gestión de turnos, pagos y asistencia
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl"
          >
            Salir
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow grid md:grid-cols-5 gap-3">
          <input
            placeholder="Buscar por paciente, DNI, celular, sede o beneficio"
            className="border p-2 rounded-xl"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border p-2 rounded-xl bg-white"
          >
            {tiposTurno.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="border p-2 rounded-xl bg-white"
          >
            {estados.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>

          <select
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            className="border p-2 rounded-xl bg-white"
          >
            {sedes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="border p-2 rounded-xl"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow overflow-auto max-h-[75vh]">
          {cargando && <p>Cargando...</p>}

          <table className="min-w-[1700px] w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b text-left sticky top-0 z-10">
                <th className="p-3">Tipo</th>
                <th className="p-3">Locación</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Hora</th>
                <th className="p-3">Paciente</th>
                <th className="p-3">DNI</th>
                <th className="p-3">Celular</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Pago</th>
                <th className="p-3">Método elegido</th>
                <th className="p-3">Medio real</th>
                <th className="p-3">Beneficio</th>
                <th className="p-3">Importe</th>
                <th className="p-3">Penalidad</th>
                <th className="p-3">Acciones</th>
                <th className="p-3">Asistencia</th>
              </tr>
            </thead>

            <tbody>
              {turnosFiltrados.map((t) => {
                const estaConfirmado = t.estado === "Confirmado";
                const pagoConfirmado = t.pagado || t.estado === "Confirmado";
                const finalizado = esEstadoFinal(t.estado);

                const puedeConfirmarPago = !pagoConfirmado && !finalizado;

                const puedeConfirmarPenalidad =
                  t.estado === "Reprogramado" &&
                  t.penalidad_pendiente &&
                  !t.penalidad_pagada;

                const puedeMarcarAsistencia = estaConfirmado && !finalizado;

                const beneficio = mostrarBeneficio(t);
                const tieneBeneficio = beneficio !== "Estándar";

                return (
                  <tr key={t.id} className="border-b align-top">
                    <td className="p-3">
                      {t.tipo_turno || "Carnet Profesional"}
                    </td>

                    <td className="p-3">{t.locacion || "-"}</td>
                    <td className="p-3">{t.fecha}</td>
                    <td className="p-3 font-semibold">{t.horario}</td>
                    <td className="p-3">{t.nombre}</td>
                    <td className="p-3">{t.dni || "-"}</td>
                    <td className="p-3">{t.celular}</td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${badgeEstado(
                          t.estado
                        )}`}
                      >
                        {t.estado || "Pendiente de pago"}
                      </span>
                    </td>

                    <td className="p-3">
                      {pagoConfirmado ? (
                        <span className="text-green-700 font-semibold">
                          Pagado
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold">
                          No pagado
                        </span>
                      )}
                    </td>

                    <td className="p-3">{t.metodo_pago || "-"}</td>

                    <td className="p-3">
                      {t.medio_pago_real ? (
                        <span className="text-green-700 font-semibold">
                          {t.medio_pago_real}
                        </span>
                      ) : puedeConfirmarPago ? (
                        <select
                          className="border rounded-xl p-2 text-xs bg-white"
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
                    </td>

                    <td className="p-3">
                      {tieneBeneficio ? (
                        <span className="text-purple-700 font-semibold">
                          {beneficio}
                        </span>
                      ) : (
                        <span className="text-slate-600">Estándar</span>
                      )}
                    </td>

                    <td className="p-3 font-semibold">
                      {formatearImporte(t.importe_servicio)}
                    </td>

                    <td className="p-3">
                      {t.penalidad_pendiente && !t.penalidad_pagada ? (
                        <span className="text-red-700 font-semibold">
                          30% pendiente
                        </span>
                      ) : t.penalidad_pagada ? (
                        <span className="text-green-700 font-semibold">
                          Penalidad pagada
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => confirmarPago(t)}
                          disabled={!puedeConfirmarPago}
                          className={`px-3 py-2 rounded-xl text-xs text-white ${pagoConfirmado
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            : puedeConfirmarPago
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-slate-300 cursor-not-allowed opacity-60"
                            }`}
                        >
                          {pagoConfirmado ? "Pago confirmado" : "Confirmar pago"}
                        </button>

                        <button
                          onClick={() => confirmarPenalidad(t)}
                          disabled={!puedeConfirmarPenalidad}
                          className={`px-3 py-2 rounded-xl text-xs text-white ${puedeConfirmarPenalidad
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            }`}
                        >
                          {t.penalidad_pagada
                            ? "Penalidad pagada"
                            : "Confirmar penalidad"}
                        </button>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => marcarRealizado(t)}
                          disabled={!puedeMarcarAsistencia}
                          className={`px-3 py-2 rounded-xl text-xs text-white ${t.estado === "Realizado"
                            ? "bg-blue-200 text-blue-800 cursor-not-allowed"
                            : puedeMarcarAsistencia
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            }`}
                        >
                          {t.estado === "Realizado"
                            ? "✔ Se presentó"
                            : "Se presentó"}
                        </button>

                        <button
                          onClick={() => marcarAusente(t)}
                          disabled={!puedeMarcarAsistencia}
                          className={`px-3 py-2 rounded-xl text-xs text-white ${t.estado === "Ausente"
                            ? "bg-slate-400 cursor-not-allowed"
                            : puedeMarcarAsistencia
                              ? "bg-slate-700 hover:bg-slate-800"
                              : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            }`}
                        >
                          {t.estado === "Ausente" ? "✔ Ausente" : "No se presentó"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!cargando && turnosFiltrados.length === 0 && (
            <p className="text-sm text-slate-500 mt-4">
              No hay turnos para los filtros seleccionados.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}