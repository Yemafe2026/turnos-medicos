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

const tiposTurno = [
  "Todos",
  "Carnet Profesional",
  "Licencia Particular",
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
      .order("fecha", { ascending: true });

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
  }, []);

  const confirmarPago = async (turno) => {
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
Horario: ${turno.horario}`,
      }),
    });

    cargarTurnos();
  };

  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const tipo = t.tipo_turno || "Carnet Profesional";

      const coincideTipo =
        filtroTipo === "Todos" || tipo === filtroTipo;

      const coincideEstado =
        filtroEstado === "Todos" || t.estado === filtroEstado;

      const coincideSede =
        filtroSede === "Todas" || t.locacion === filtroSede;

      const coincideFecha =
        !filtroFecha || t.fecha === filtroFecha;

      const texto = `${t.nombre} ${t.dni} ${t.celular}`.toLowerCase();

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
            <img src="/logo.png" className="h-14" />
            <h1 className="text-2xl font-bold">Panel Administrativo</h1>
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
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select onChange={(e) => setFiltroTipo(e.target.value)} className="border p-2 rounded-xl">
            {tiposTurno.map((t) => <option key={t}>{t}</option>)}
          </select>

          <select onChange={(e) => setFiltroEstado(e.target.value)} className="border p-2 rounded-xl">
            {estados.map((e) => <option key={e}>{e}</option>)}
          </select>

          <select onChange={(e) => setFiltroSede(e.target.value)} className="border p-2 rounded-xl">
            <option>Todas</option>
            {sedes.map((s) => <option key={s}>{s}</option>)}
          </select>

          <input type="date" onChange={(e) => setFiltroFecha(e.target.value)} className="border p-2 rounded-xl" />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow overflow-x-auto">
          {cargando && <p>Cargando...</p>}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-2">Tipo</th>
                <th className="p-2">Fecha</th>
                <th className="p-2">Hora</th>
                <th className="p-2">Paciente</th>
                <th className="p-2">Celular</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Pago</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {turnosFiltrados.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="p-2">{t.tipo_turno || "Carnet Profesional"}</td>
                  <td className="p-2">{t.fecha}</td>
                  <td className="p-2">{t.horario}</td>
                  <td className="p-2">{t.nombre}</td>
                  <td className="p-2">{t.celular}</td>

                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${badgeEstado(t.estado)}`}>
                      {t.estado}
                    </span>
                  </td>

                  <td className="p-2">
                    {t.pagado ? "Pagado" : "No pagado"}
                  </td>

                  <td className="p-2">
                    <button
                      onClick={() => confirmarPago(t)}
                      className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                    >
                      Confirmar pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>
    </main>
  );
}