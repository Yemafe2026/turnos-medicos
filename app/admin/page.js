"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

const sedes = ["Sede Cipolletti", "Sede Neuquén", "Sede Plaza Huincul"];

const estados = [
  "Todos",
  "Pendiente de pago",
  "Confirmado",
  "No Confirmado",
  "Ausente",
];

function formatearFechaHora(valor) {
  if (!valor) return "-";
  return new Date(valor).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function badgeEstado(estado) {
  if (estado === "Confirmado") return "bg-green-100 text-green-800";
  if (estado === "Pagado") return "bg-blue-100 text-blue-800";
  if (estado === "Ausente") return "bg-slate-200 text-slate-800";
  if (estado === "No Confirmado") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function estadoVencimiento(turno) {
  if (turno.pagado || turno.estado !== "Pendiente de pago") return "OK";
  if (!turno.vencimiento_pago_at) return "Sin vencimiento";

  const ahora = new Date();
  const vencimiento = new Date(turno.vencimiento_pago_at);
  const diffMin = (vencimiento - ahora) / 1000 / 60;

  if (diffMin <= 0) return "Vencido";
  if (diffMin <= 120) return "Por vencer";
  return "Vigente";
}

function badgeVencimiento(valor) {
  if (valor === "Vencido") return "bg-red-100 text-red-800";
  if (valor === "Por vencer") return "bg-orange-100 text-orange-800";
  if (valor === "Vigente") return "bg-green-100 text-green-800";
  return "bg-slate-100 text-slate-700";
}

export default function AdminPage() {
  const router = useRouter();

  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [filtroFecha, setFiltroFecha] = useState("");

  const cargarTurnos = async () => {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
      .from("turnos")
      .select("*")
      .order("fecha", { ascending: true })
      .order("horario", { ascending: true });

    setCargando(false);

    if (error) {
      console.error(error);
      setError("No se pudieron cargar los turnos.");
      return;
    }

    setTurnos(data || []);
  };

  useEffect(() => {
    const iniciar = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/admin/login");
        return;
      }

      cargarTurnos();
    };

    iniciar();
  }, [router]);

  const confirmarPago = async (id) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        pagado: true,
        pago_confirmado_at: new Date().toISOString(),
        estado: "Confirmado",
        whatsapp_confirmacion_simulado: true,
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo confirmar el pago.");
      return;
    }

    cargarTurnos();
  };


  const noConfirmarTurno = async (id, motivo = "No confirmado manualmente") => {
    const { error } = await supabase
      .from("turnos")
      .update({
        estado: "No Confirmado",
        motivo_no_confirmacion: motivo,
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo actualizar.");
      return;
    }

    cargarTurnos();
  };

  const marcarAusente = async (id) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        ausente: true,
        estado: "Ausente",
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo marcar ausente.");
      return;
    }

    cargarTurnos();
  };

  const liberarPagosVencidos = async () => {
    setProcesando(true);

    const ahora = new Date();

    for (const turno of turnos) {
      if (turno.estado !== "Pendiente de pago") continue;
      if (turno.pagado) continue;
      if (!turno.vencimiento_pago_at) continue;

      const vencimiento = new Date(turno.vencimiento_pago_at);

      if (vencimiento <= ahora) {
        await supabase
          .from("turnos")
          .update({
            estado: "No Confirmado",
            vencido_automaticamente: true,
            motivo_no_confirmacion: "Pago no confirmado antes del vencimiento",
          })
          .eq("id", turno.id);
      }
    }

    setProcesando(false);
    cargarTurnos();
    alert("Pagos vencidos liberados.");
  };

  const ejecutarRecordatorios = async () => {
    setProcesando(true);

    const ahora = new Date();
    const ms24 = 24 * 60 * 60 * 1000;
    const ms2 = 2 * 60 * 60 * 1000;

    for (const turno of turnos) {
      if (turno.estado !== "Confirmado") continue;

      const fechaHora = new Date(`${turno.fecha}T${turno.horario}:00`);
      const diferencia = fechaHora - ahora;

      if (
        diferencia <= ms24 &&
        diferencia > ms2 &&
        !turno.recordatorio_24h_simulado
      ) {
        await supabase
          .from("turnos")
          .update({ recordatorio_24h_simulado: true })
          .eq("id", turno.id);
      }

      if (
        diferencia <= ms2 &&
        diferencia > 0 &&
        !turno.recordatorio_2h_simulado
      ) {
        await supabase
          .from("turnos")
          .update({ recordatorio_2h_simulado: true })
          .eq("id", turno.id);
      }
    }

    setProcesando(false);
    cargarTurnos();
    alert("Recordatorios simulados ejecutados.");
  };

  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const coincideEstado =
        filtroEstado === "Todos" || t.estado === filtroEstado;

      const coincideSede = filtroSede === "Todas" || t.locacion === filtroSede;
      const coincideFecha = !filtroFecha || t.fecha === filtroFecha;

      const texto = `${t.nombre || ""} ${t.dni || ""} ${t.celular || ""} ${t.metodo_pago || ""
        }`.toLowerCase();

      return (
        coincideEstado &&
        coincideSede &&
        coincideFecha &&
        texto.includes(busqueda.toLowerCase())
      );
    });
  }, [turnos, filtroEstado, filtroSede, filtroFecha, busqueda]);

  const metricas = useMemo(() => {
    return {
      total: turnos.length,
      pendientesPago: turnos.filter((t) => t.estado === "Pendiente de pago")
        .length,
      pagados: turnos.filter((t) => t.pagado).length,
      confirmados: turnos.filter((t) => t.estado === "Confirmado").length,
      vencidos: turnos.filter((t) => estadoVencimiento(t) === "Vencido")
        .length,
      porVencer: turnos.filter((t) => estadoVencimiento(t) === "Por vencer")
        .length,
      ausentes: turnos.filter((t) => t.estado === "Ausente").length,
    };
  }, [turnos]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">

            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Laboral Salud"
                className="h-16 object-contain"
              />

              <div>
                <h1 className="text-3xl font-bold">Panel Administrativo</h1>
                <p className="text-slate-500">Gestión de pagos y turnos</p>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={cargarTurnos} className="border rounded-xl px-4 py-2">
                Actualizar
              </button>

              <button
                onClick={liberarPagosVencidos}
                disabled={procesando}
                className="bg-red-600 text-white rounded-xl px-4 py-2"
              >
                Liberar pagos vencidos
              </button>

              <button
                onClick={ejecutarRecordatorios}
                disabled={procesando}
                className="bg-blue-600 text-white rounded-xl px-4 py-2"
              >
                Ejecutar recordatorios
              </button>

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/admin/login");
                }}
                className="bg-orange-500 text-white rounded-xl px-4 py-2"
              >
                Salir
              </button>
            </div>

          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-3xl font-bold">{metricas.total}</p>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Pendientes de pago</p>
            <p className="text-3xl font-bold">{metricas.pendientesPago}</p>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Pagados</p>
            <p className="text-3xl font-bold">{metricas.pagados}</p>
          </div>

          <div className="bg-green-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Confirmados</p>
            <p className="text-3xl font-bold">{metricas.confirmados}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-red-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Pagos vencidos</p>
            <p className="text-2xl font-bold">{metricas.vencidos}</p>
          </div>

          <div className="bg-orange-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Por vencer</p>
            <p className="text-2xl font-bold">{metricas.porVencer}</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Ausentes</p>
            <p className="text-2xl font-bold">{metricas.ausentes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="grid md:grid-cols-4 gap-3">
            <input
              className="border rounded-xl p-3"
              placeholder="Buscar nombre, DNI, celular o método"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <select
              className="border rounded-xl p-3 bg-white"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              {estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>

            <select
              className="border rounded-xl p-3 bg-white"
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
            >
              <option>Todas</option>
              {sedes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <input
              type="date"
              className="border rounded-xl p-3"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow overflow-x-auto">
          {cargando && <p>Cargando...</p>}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
              {error}
            </div>
          )}

          {!cargando && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Sede</th>
                  <th className="p-3">Método</th>
                  <th className="p-3">Vencimiento pago</th>
                  <th className="p-3">Pago</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {turnosFiltrados.map((t) => {
                  const vencimiento = estadoVencimiento(t);

                  return (
                    <tr key={t.id} className="border-b align-top">
                      <td className="p-3">{t.fecha}</td>
                      <td className="p-3 font-semibold">{t.horario}</td>
                      <td className="p-3">{t.nombre}</td>
                      <td className="p-3">{t.celular || "-"}</td>
                      <td className="p-3">{t.locacion}</td>
                      <td className="p-3">{t.metodo_pago || "-"}</td>

                      <td className="p-3">
                        <div>{formatearFechaHora(t.vencimiento_pago_at)}</div>
                        <span
                          className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${badgeVencimiento(
                            vencimiento
                          )}`}
                        >
                          {vencimiento}
                        </span>
                      </td>

                      <td className="p-3">
                        {t.pagado ? (
                          <span className="text-green-700 font-semibold">
                            Pagado
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold">
                            No pagado
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${badgeEstado(
                            t.estado
                          )}`}
                        >
                          {t.estado || "Pendiente de pago"}
                        </span>
                      </td>

                      <td className="p-3 min-w-[360px]">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => confirmarPago(t.id)}
                            disabled={t.pagado || t.estado === "No Confirmado"}
                            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs disabled:bg-slate-300"
                          >
                            Confirmar pago y turno
                          </button>

                          <button
                            onClick={() =>
                              noConfirmarTurno(t.id, "Cancelado manualmente")
                            }
                            disabled={t.estado === "No Confirmado"}
                            className="bg-red-600 text-white px-3 py-2 rounded-xl text-xs disabled:bg-slate-300"
                          >
                            No confirmar
                          </button>

                          <button
                            onClick={() => marcarAusente(t.id)}
                            disabled={t.estado === "Ausente"}
                            className="bg-slate-700 text-white px-3 py-2 rounded-xl text-xs disabled:bg-slate-300"
                          >
                            Ausente
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}