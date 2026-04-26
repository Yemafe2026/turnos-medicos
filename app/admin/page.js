"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

const motivosNoConfirmacion = [
  "Pago no registrado",
  "Pedido de cancelación del turno",
  "Pedido de reprogramación de turno",
  "Problemas de la organización interna",
];

const sedes = [
  "Sede Cipolletti",
  "Sede Neuquén",
  "Sede Plaza Huincul",
];

function formatearFecha(fecha) {
  return fecha.toISOString().split("T")[0];
}

function obtenerSemanaActual() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diferenciaLunes = dia === 0 ? -6 : 1 - dia;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diferenciaLunes);
  lunes.setHours(0, 0, 0, 0);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  return {
    inicio: formatearFecha(lunes),
    fin: formatearFecha(domingo),
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [motivos, setMotivos] = useState({});

  const [sedeImpresion, setSedeImpresion] = useState("Sede Cipolletti");
  const [fechaImpresion, setFechaImpresion] = useState(formatearFecha(new Date()));

  const semanaActual = obtenerSemanaActual();

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

  const confirmarTurno = async (id) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        estado: "Confirmado",
        motivo_no_confirmacion: null,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("No se pudo confirmar el turno.");
      return;
    }

    cargarTurnos();
  };

  const noConfirmarTurno = async (id) => {
    const motivo = motivos[id];

    if (!motivo) {
      alert("Seleccione un motivo para no confirmar el turno.");
      return;
    }

    const { error } = await supabase
      .from("turnos")
      .update({
        estado: "No Confirmado",
        motivo_no_confirmacion: motivo,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("No se pudo no confirmar el turno.");
      return;
    }

    cargarTurnos();
  };

    useEffect(() => {
    const verificarSesion = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/admin/login");
        return;
      }

      cargarTurnos();
    };

    verificarSesion();
  }, [router]);

  const turnosSemanaActual = useMemo(() => {
    return turnos.filter(
      (turno) =>
        turno.fecha >= semanaActual.inicio &&
        turno.fecha <= semanaActual.fin
    );
  }, [turnos, semanaActual.inicio, semanaActual.fin]);

  const reportes = useMemo(() => {
    const total = turnosSemanaActual.length;
    const pendientes = turnosSemanaActual.filter((t) => t.estado === "Pendiente").length;
    const confirmados = turnosSemanaActual.filter((t) => t.estado === "Confirmado").length;
    const noConfirmados = turnosSemanaActual.filter((t) => t.estado === "No Confirmado").length;

    const porSede = turnosSemanaActual.reduce((acc, turno) => {
      acc[turno.locacion] = (acc[turno.locacion] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      pendientes,
      confirmados,
      noConfirmados,
      porSede,
    };
  }, [turnosSemanaActual]);

  const turnosPendientes = turnos.filter((t) => t.estado === "Pendiente");

  const turnosParaImprimir = turnos.filter(
    (turno) =>
      turno.estado === "Confirmado" &&
      turno.locacion === sedeImpresion &&
      turno.fecha === fechaImpresion
  );

  const imprimirListado = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #area-impresion,
          #area-impresion * {
            visibility: visible;
          }

          #area-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 24px;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow no-print">
          <h1 className="text-3xl font-bold text-slate-900">
            Panel de Recepción
          </h1>

          <p className="mt-2 text-slate-600">
            Control operativo de pre-reservas, confirmaciones manuales y carga pendiente.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            className="mt-4 border rounded-xl px-4 py-2 text-sm hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow no-print">
          <h2 className="text-xl font-semibold">
            Resumen operativo - Semana actual
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Semana actual: <strong>{semanaActual.inicio}</strong> al{" "}
            <strong>{semanaActual.fin}</strong>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 no-print">
          <div className="bg-white rounded-2xl p-5 shadow">
            <p className="text-sm text-slate-500">Total reservas</p>
            <p className="text-xs text-slate-400 mb-2">Semana actual</p>
            <p className="text-3xl font-bold">{reportes.total}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow">
            <p className="text-sm text-amber-700">Pendientes</p>
            <p className="text-xs text-amber-600 mb-2">Semana actual</p>
            <p className="text-3xl font-bold text-amber-800">
              {reportes.pendientes}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 shadow">
            <p className="text-sm text-green-700">Confirmados</p>
            <p className="text-xs text-green-600 mb-2">Semana actual</p>
            <p className="text-3xl font-bold text-green-800">
              {reportes.confirmados}
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow">
            <p className="text-sm text-red-700">No confirmados</p>
            <p className="text-xs text-red-600 mb-2">Semana actual</p>
            <p className="text-3xl font-bold text-red-800">
              {reportes.noConfirmados}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow no-print">
          <h2 className="text-xl font-semibold mb-1">
            Reservas por sede - Semana actual
          </h2>

          <p className="text-sm text-slate-500 mb-4">
            Incluye reservas con fecha entre {semanaActual.inicio} y {semanaActual.fin}.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {sedes.map((sede) => (
              <div key={sede} className="border rounded-xl p-4">
                <p className="text-sm text-slate-500">{sede}</p>
                <p className="text-2xl font-bold">
                  {reportes.porSede[sede] || 0}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow no-print">
          <h2 className="text-xl font-semibold mb-4">
            Listado diario para imprimir
          </h2>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label className="block text-sm font-medium mb-1">
                Sede
              </label>

              <select
                className="w-full border rounded-xl p-3 bg-white"
                value={sedeImpresion}
                onChange={(e) => setSedeImpresion(e.target.value)}
              >
                {sedes.map((sede) => (
                  <option key={sede} value={sede}>
                    {sede}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Fecha
              </label>

              <input
                type="date"
                className="w-full border rounded-xl p-3"
                value={fechaImpresion}
                onChange={(e) => setFechaImpresion(e.target.value)}
              />
            </div>

            <button
              onClick={imprimirListado}
              className="bg-slate-900 text-white rounded-xl px-5 py-3"
            >
              Imprimir listado
            </button>
          </div>
        </div>

        <div id="area-impresion" className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-2xl font-bold mb-2">
            Listado diario de turnos confirmados
          </h2>

          <p className="text-sm mb-1">
            <strong>Sede:</strong> {sedeImpresion}
          </p>

          <p className="text-sm mb-6">
            <strong>Fecha:</strong> {fechaImpresion}
          </p>

          {turnosParaImprimir.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay turnos confirmados para la sede y fecha seleccionadas.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="p-3 border">Hora</th>
                  <th className="p-3 border">Paciente</th>
                  <th className="p-3 border">DNI</th>
                  <th className="p-3 border">+65?</th>
                  <th className="p-3 border">Laboratorio anterior?</th>
                </tr>
              </thead>

              <tbody>
                {turnosParaImprimir.map((turno) => (
                  <tr key={turno.id} className="border-b">
                    <td className="p-3 border font-semibold">{turno.horario}</td>
                    <td className="p-3 border">{turno.nombre}</td>
                    <td className="p-3 border">{turno.dni}</td>
                    <td className="p-3 border">{turno.mayor65 || "-"}</td>
                    <td className="p-3 border">{turno.laboratorio_reciente || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow no-print">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">
                Pendientes por validar
              </h2>
              <p className="text-sm text-slate-500">
                Muestra todas las pre-reservas pendientes, independientemente de la fecha del turno.
              </p>
            </div>

            <button
              onClick={cargarTurnos}
              className="border rounded-xl px-4 py-2 text-sm"
            >
              Actualizar
            </button>
          </div>

          {cargando && (
            <p className="text-slate-500 text-sm">
              Cargando turnos...
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
              {error}
            </div>
          )}

          {!cargando && turnosPendientes.length === 0 && (
            <p className="text-slate-500 text-sm">
              No hay reservas pendientes en este momento.
            </p>
          )}

          {turnosPendientes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Hora</th>
                    <th className="p-3">Sede</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">DNI</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {turnosPendientes.map((turno) => (
                    <tr key={turno.id} className="border-b align-top">
                      <td className="p-3">{turno.fecha}</td>
                      <td className="p-3 font-semibold">{turno.horario}</td>
                      <td className="p-3">{turno.locacion}</td>
                      <td className="p-3">{turno.nombre}</td>
                      <td className="p-3">{turno.dni}</td>

                      <td className="p-3">
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold">
                          {turno.estado}
                        </span>
                      </td>

                      <td className="p-3 min-w-[220px]">
                        <select
                          className="w-full border rounded-xl p-2 bg-white text-xs"
                          value={motivos[turno.id] || ""}
                          onChange={(e) =>
                            setMotivos({
                              ...motivos,
                              [turno.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">Motivo para no confirmar</option>

                          {motivosNoConfirmacion.map((motivo) => (
                            <option key={motivo} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3 min-w-[230px]">
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmarTurno(turno.id)}
                            className="bg-green-700 text-white rounded-xl px-3 py-2 text-xs"
                          >
                            Confirmar
                          </button>

                          <button
                            onClick={() => noConfirmarTurno(turno.id)}
                            className="bg-red-700 text-white rounded-xl px-3 py-2 text-xs"
                          >
                            No confirmar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}