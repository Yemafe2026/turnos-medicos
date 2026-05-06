"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

const sedes = ["Sede Cipolletti", "Sede Neuquén", "Sede Plaza Huincul"];

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

  const confirmarPago = async (turno) => {
    if (turno.pagado || turno.estado === "Confirmado") return;

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
Fecha: ${turno.fecha}
Horario: ${turno.horario}
Sede: ${turno.locacion}

Te esperamos.`,
      }),
    });

    cargarTurnos();
  };

  const marcarRealizado = async (turno) => {
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
            placeholder="Buscar"
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
            <option>Todas</option>
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

                return (
                  <tr key={t.id} className="border-b align-top">
                    <td className="p-3">
                      {t.tipo_turno || "Carnet Profesional"}
                    </td>

                    <td className="p-3">{t.locacion || "-"}</td>

                    <td className="p-3">{t.fecha}</td>

                    <td className="p-3 font-semibold">{t.horario}</td>

                    <td className="p-3">{t.nombre}</td>

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

                        {!t.comprobante_recibido ? (
                          <button
                            onClick={async () => {
                              await supabase
                                .from("turnos")
                                .update({
                                  comprobante_recibido: true,
                                })
                                .eq("id", t.id);

                              cargarTurnos();
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs"
                          >
                            Comprobante recibido
                          </button>
                        ) : (
                          <button
                            disabled
                            className="bg-green-200 text-green-800 px-3 py-2 rounded-xl text-xs cursor-not-allowed"
                          >
                            ✔ Comprobante recibido
                          </button>
                        )}

                        <button
                          onClick={() => confirmarPago(t)}
                          disabled={pagoConfirmado || !t.comprobante_recibido}
                          className={`px-3 py-2 rounded-xl text-xs text-white ${pagoConfirmado
                              ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                              : t.comprobante_recibido
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-slate-300 cursor-not-allowed"
                            }`}
                        >
                          {pagoConfirmado ? "Pago confirmado" : "Confirmar pago"}
                        </button>

                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => marcarRealizado(t)}
                          disabled={!estaConfirmado}
                          className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Se presentó
                        </button>

                        <button
                          onClick={() => marcarAusente(t)}
                          disabled={!estaConfirmado}
                          className="bg-slate-700 text-white px-3 py-2 rounded-xl text-xs disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          No se presentó
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