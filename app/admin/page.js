"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

const sedes = [
  "Sede Cipolletti",
  "Sede Neuquén",
  "Sede Plaza Huincul",
];

const estados = [
  "Todos",
  "Pendiente",
  "Confirmado",
  "No Confirmado",
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function badgeEstado(estado) {
  if (estado === "Confirmado") {
    return "bg-green-100 text-green-800";
  }

  if (estado === "No Confirmado") {
    return "bg-red-100 text-red-800";
  }

  return "bg-amber-100 text-amber-800";
}

function textoSeguro(valor) {
  return valor || "-";
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

  const confirmarTurno = async (id) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        estado: "Confirmado",
        whatsapp_confirmacion_simulado: true,
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo confirmar.");
      return;
    }

    cargarTurnos();
  };

  const noConfirmarTurno = async (id) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        estado: "No Confirmado",
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo actualizar.");
      return;
    }

    cargarTurnos();
  };

  const ejecutarRecordatorios = async () => {
    setProcesando(true);

    const hoy = new Date();
    const ms24 = 24 * 60 * 60 * 1000;
    const ms2 = 2 * 60 * 60 * 1000;

    for (const turno of turnos) {
      if (turno.estado !== "Confirmado") continue;

      const fechaHora = new Date(`${turno.fecha}T${turno.horario}:00`);
      const diferencia = fechaHora - hoy;

      if (
        diferencia <= ms24 &&
        diferencia > ms2 &&
        !turno.recordatorio_24h_simulado
      ) {
        await supabase
          .from("turnos")
          .update({
            recordatorio_24h_simulado: true,
          })
          .eq("id", turno.id);
      }

      if (
        diferencia <= ms2 &&
        diferencia > 0 &&
        !turno.recordatorio_2h_simulado
      ) {
        await supabase
          .from("turnos")
          .update({
            recordatorio_2h_simulado: true,
          })
          .eq("id", turno.id);
      }
    }

    setProcesando(false);
    cargarTurnos();
    alert("Recordatorios simulados ejecutados.");
  };

  const liberarPendientes = async () => {
    setProcesando(true);

    const ahora = new Date();

    for (const turno of turnos) {
      if (turno.estado !== "Pendiente") continue;
      if (!turno.created_at) continue;

      const creado = new Date(turno.created_at);
      const minutos = (ahora - creado) / 1000 / 60;

      if (minutos >= 60) {
        await supabase
          .from("turnos")
          .update({
            estado: "No Confirmado",
            vencido_automaticamente: true,
            motivo_no_confirmacion:
              "Pre-reserva vencida automáticamente",
          })
          .eq("id", turno.id);
      }
    }

    setProcesando(false);
    cargarTurnos();
    alert("Pendientes vencidos liberados.");
  };

  const marcarAusente = async (id) => {
    await supabase
      .from("turnos")
      .update({
        ausente: true,
      })
      .eq("id", id);

    cargarTurnos();
  };

  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const coincideEstado =
        filtroEstado === "Todos" || t.estado === filtroEstado;

      const coincideSede =
        filtroSede === "Todas" || t.locacion === filtroSede;

      const coincideFecha =
        !filtroFecha || t.fecha === filtroFecha;

      const texto = `${t.nombre || ""} ${t.dni || ""} ${t.celular || ""
        }`.toLowerCase();

      const coincideBusqueda = texto.includes(
        busqueda.toLowerCase()
      );

      return (
        coincideEstado &&
        coincideSede &&
        coincideFecha &&
        coincideBusqueda
      );
    });
  }, [
    turnos,
    filtroEstado,
    filtroSede,
    filtroFecha,
    busqueda,
  ]);

  const metricas = useMemo(() => {
    const total = turnos.length;
    const pendientes = turnos.filter(
      (t) => t.estado === "Pendiente"
    ).length;

    const confirmados = turnos.filter(
      (t) => t.estado === "Confirmado"
    ).length;

    const noConfirmados = turnos.filter(
      (t) => t.estado === "No Confirmado"
    ).length;

    const ausentes = turnos.filter((t) => t.ausente).length;

    const record24 = turnos.filter(
      (t) => t.recordatorio_24h_simulado
    ).length;

    const record2 = turnos.filter(
      (t) => t.recordatorio_2h_simulado
    ).length;

    const vencidos = turnos.filter(
      (t) => t.vencido_automaticamente
    ).length;

    return {
      total,
      pendientes,
      confirmados,
      noConfirmados,
      ausentes,
      record24,
      record2,
      vencidos,
    };
  }, [turnos]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex flex-col md:flex-row md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                Panel Administrativo
              </h1>
              <p className="text-slate-500">
                turnos-medicos-beta
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={cargarTurnos}
                className="border rounded-xl px-4 py-2"
              >
                Actualizar
              </button>

              <button
                onClick={ejecutarRecordatorios}
                disabled={procesando}
                className="bg-blue-600 text-white rounded-xl px-4 py-2"
              >
                Ejecutar recordatorios
              </button>

              <button
                onClick={liberarPendientes}
                disabled={procesando}
                className="bg-red-600 text-white rounded-xl px-4 py-2"
              >
                Liberar vencidos
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
            <p className="text-sm">Pendientes</p>
            <p className="text-3xl font-bold">
              {metricas.pendientes}
            </p>
          </div>

          <div className="bg-green-50 rounded-2xl p-4 shadow">
            <p className="text-sm">Confirmados</p>
            <p className="text-3xl font-bold">
              {metricas.confirmados}
            </p>
          </div>

          <div className="bg-red-50 rounded-2xl p-4 shadow">
            <p className="text-sm">No confirmados</p>
            <p className="text-3xl font-bold">
              {metricas.noConfirmados}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm">Ausentes</p>
            <p className="text-2xl font-bold">
              {metricas.ausentes}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm">Recordatorio 24h</p>
            <p className="text-2xl font-bold">
              {metricas.record24}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm">Recordatorio 2h</p>
            <p className="text-2xl font-bold">
              {metricas.record2}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm">Pendientes vencidos</p>
            <p className="text-2xl font-bold">
              {metricas.vencidos}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="grid md:grid-cols-4 gap-3">
            <input
              className="border rounded-xl p-3"
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) =>
                setBusqueda(e.target.value)
              }
            />

            <select
              className="border rounded-xl p-3"
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(e.target.value)
              }
            >
              {estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>

            <select
              className="border rounded-xl p-3"
              value={filtroSede}
              onChange={(e) =>
                setFiltroSede(e.target.value)
              }
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
              onChange={(e) =>
                setFiltroFecha(e.target.value)
              }
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow overflow-x-auto">
          {cargando && <p>Cargando...</p>}
          {error && <p>{error}</p>}

          {!cargando && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Sede</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {turnosFiltrados.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.fecha}</td>
                    <td className="p-3 font-semibold">
                      {t.horario}
                    </td>
                    <td className="p-3">{t.nombre}</td>
                    <td className="p-3">
                      {textoSeguro(t.celular)}
                    </td>
                    <td className="p-3">{t.locacion}</td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${badgeEstado(
                          t.estado
                        )}`}
                      >
                        {t.estado}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() =>
                            confirmarTurno(t.id)
                          }
                          className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs"
                        >
                          Confirmar
                        </button>

                        <button
                          onClick={() =>
                            noConfirmarTurno(t.id)
                          }
                          className="bg-red-600 text-white px-3 py-2 rounded-xl text-xs"
                        >
                          No confirmar
                        </button>

                        <button
                          onClick={() =>
                            marcarAusente(t.id)
                          }
                          className="bg-slate-700 text-white px-3 py-2 rounded-xl text-xs"
                        >
                          Ausente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}