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
];

const tiposTurno = ["Todos", "Carnet Profesional", "Licencia Particular"];

function badgeEstado(estado) {
  if (estado === "Confirmado") return "bg-green-100 text-green-800";
  if (estado === "Realizado") return "bg-blue-100 text-blue-800";
  if (estado === "Ausente") return "bg-slate-200 text-slate-800";
  if (estado === "No Confirmado") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function esEstadoFinal(estado) {
  return ["Realizado", "Ausente", "No Confirmado", "Cancelado"].includes(
    estado
  );
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

  const marcarComprobanteRecibido = async (turno) => {
    if (turno.comprobante_recibido || turno.pagado || esEstadoFinal(turno.estado)) {
      return;
    }

    await supabase
      .from("turnos")
      .update({
        comprobante_recibido: true,
      })
      .eq("id", turno.id);

    cargarTurnos();
  };

  const confirmarPago = async (turno) => {
    if (
      turno.pagado ||
      turno.estado === "Confirmado" ||
      !turno.comprobante_recibido ||
      esEstadoFinal(turno.estado)
    ) {
      return;
    }

    await supabase
      .from("turnos")
      .update({
        pagado: true,
        estado: "Confirmado",
        pago_confirmado_at: new Date().toISOString(),
      })
      .eq("id", turno.id);

    await fetch("/api/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telefono: turno.celular,
        mensaje: `Hola ${turno.nombre}, tu turno fue CONFIRMADO.

Fecha del Turno: ${turno.fecha}
Horario del Turno: ${turno.horario}
Sede: ${turno.locacion}

Te esperamos.`,
      }),
    });

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

    await supabase
      .from("turnos")
      .update({
        estado: "Ausente",
        ausente: true,
      })
      .eq("id", turno.id);

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
        } ${tipo}`.toLowerCase();

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
            placeholder="Buscar por paciente, DNI, celular o sede"
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

        <div className="bg-white p-6 rounded-2xl shadow overflow-x-auto">
          {cargando && <p>Cargando...</p>}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-left">
                <th className="p-3">Tipo</th>
                <th className="p-3">Locación</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Hora</th>
                <th className="p-3">Paciente</th>
                <th className="p-3">DNI</th>
                <th className="p-3">Celular</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Pago</th>
                <th className="p-3">Acciones</th>
                <th className="p-3">Asistencia</th>
              </tr>
            </thead>

            <tbody>
              {turnosFiltrados.map((t) => {
                const estaConfirmado = t.estado === "Confirmado";
                const pagoConfirmado = t.pagado || t.estado === "Confirmado";
                const finalizado = esEstadoFinal(t.estado);
                const puedeRecibirComprobante =
                  !t.comprobante_recibido && !pagoConfirmado && !finalizado;
                const puedeConfirmarPago =
                  t.comprobante_recibido && !pagoConfirmado && !finalizado;
                const puedeMarcarAsistencia =
                  estaConfirmado && !finalizado;

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

                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => marcarComprobanteRecibido(t)}
                          disabled={!puedeRecibirComprobante}
                          className={`px-3 py-2 rounded-xl text-xs ${t.comprobante_recibido
                              ? "bg-green-200 text-green-800 cursor-not-allowed"
                              : puedeRecibirComprobante
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                            }`}
                        >
                          {t.comprobante_recibido
                            ? "✔ Comprobante recibido"
                            : "Comprobante recibido"}
                        </button>

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
                          {pagoConfirmado
                            ? "Pago confirmado"
                            : "Confirmar pago"}
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
                          {t.estado === "Ausente"
                            ? "✔ Ausente"
                            : "No se presentó"}
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