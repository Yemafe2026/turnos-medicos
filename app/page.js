"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const locaciones = [
  "Sede Cipolletti",
  "Sede Neuquén",
  "Sede Plaza Huincul",
];

const direccionesLaboratorio = {
  "Sede Cipolletti": "Dirección de laboratorio a confirmar - Cipolletti",
  "Sede Neuquén": "Dirección de laboratorio a confirmar - Neuquén",
  "Sede Plaza Huincul": "Dirección de laboratorio a confirmar - Plaza Huincul",
};

const horarios = [
  "08:00", "08:20", "08:40",
  "09:00", "09:20", "09:40",
  "10:00", "10:20", "10:40",
  "11:00", "11:20", "11:40",
  "12:00", "12:20", "12:40",
  "13:00", "13:20", "13:40",
  "14:00"
];

export default function Home() {
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [error, setError] = useState("");
  const [turnosExistentes, setTurnosExistentes] = useState([]);

  const [form, setForm] = useState({
    nombre: "",
    dni: "",
    mayor65: "",
    tieneLaboratorioReciente: "",
    locacion: "",
    fecha: "",
    horario: "",
  });

  const cargarTurnosExistentes = async () => {
    if (!form.locacion || !form.fecha) return;

    setCargandoHorarios(true);
    setError("");

    const { data, error } = await supabase
      .from("turnos")
      .select("*")
      .eq("locacion", form.locacion)
      .eq("fecha", form.fecha);

    setCargandoHorarios(false);

    if (error) {
      console.error(error);
      setError("No se pudieron cargar los horarios disponibles.");
      return;
    }

    setTurnosExistentes(data || []);
  };

  useEffect(() => {
    if (paso === 2) {
      cargarTurnosExistentes();
    }
  }, [paso, form.locacion, form.fecha]);

  const estadoHorario = (hora) => {
    const turno = turnosExistentes.find((t) => t.horario === hora);

    if (!turno) {
      return {
        texto: "Disponible",
        bloqueado: false,
        clases: "bg-white hover:border-slate-900",
      };
    }

    if (turno.estado === "Confirmado") {
      return {
        texto: "Reserva confirmada",
        bloqueado: true,
        clases: "bg-green-100 text-green-800 border-green-300 cursor-not-allowed",
      };
    }

    return {
      texto: "Pre-reserva activa",
      bloqueado: true,
      clases: "bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed",
    };
  };

  const generarPreReserva = async () => {
    setCargando(true);
    setError("");

    const { error } = await supabase
      .from("turnos")
      .insert([
        {
          nombre: form.nombre,
          dni: form.dni,
          locacion: form.locacion,
          fecha: form.fecha,
          horario: form.horario,
          estado: "Pendiente",      
          mayor65: form.mayor65,
          laboratorio_reciente: form.tieneLaboratorioReciente,
        },
      ]);

    setCargando(false);

    if (error) {
      setError("No se pudo generar la pre-reserva. Intente nuevamente.");
      console.error(error);
      return;
    }

    setPaso(3);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow">
            <h1 className="text-3xl font-bold text-slate-900">
              Turnos Médicos
            </h1>

            <p className="mt-2 text-slate-600">
              Sistema de pre-reserva para certificados médicos de carné profesional.
            </p>
          </div>

          {paso === 1 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <h2 className="text-xl font-semibold">
                1. Datos y condiciones previas
              </h2>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre y apellido
                </label>
                <input
                  className="w-full border rounded-xl p-3"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  DNI
                </label>
                <input
                  className="w-full border rounded-xl p-3"
                  value={form.dni}
                  onChange={(e) =>
                    setForm({ ...form, dni: e.target.value })
                  }
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-sm font-semibold mb-2">
                  ¿Tiene 65 años o más?
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mayor65: "Sí" })}
                    className={`flex-1 rounded-xl border p-3 ${
                      form.mayor65 === "Sí"
                        ? "bg-slate-900 text-white"
                        : "bg-white"
                    }`}
                  >
                    Sí
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mayor65: "No" })}
                    className={`flex-1 rounded-xl border p-3 ${
                      form.mayor65 === "No"
                        ? "bg-slate-900 text-white"
                        : "bg-white"
                    }`}
                  >
                    No
                  </button>
                </div>

                {form.mayor65 === "Sí" && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-slate-700">
                    Antes de continuar, deberá consultar previamente por WhatsApp
                    al número <strong>A DEFINIR</strong>, ya que debe coordinarse
                    un estudio particular requerido por la Superintendencia de
                    Transporte de la Nación.
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-sm font-semibold mb-2">
                  ¿Tiene estudios de laboratorio realizados dentro de los últimos 90 días?
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, tieneLaboratorioReciente: "Sí" })
                    }
                    className={`flex-1 rounded-xl border p-3 ${
                      form.tieneLaboratorioReciente === "Sí"
                        ? "bg-slate-900 text-white"
                        : "bg-white"
                    }`}
                  >
                    Sí
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, tieneLaboratorioReciente: "No" })
                    }
                    className={`flex-1 rounded-xl border p-3 ${
                      form.tieneLaboratorioReciente === "No"
                        ? "bg-slate-900 text-white"
                        : "bg-white"
                    }`}
                  >
                    No
                  </button>
                </div>

                {form.tieneLaboratorioReciente === "Sí" && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-slate-700">
                    Deberá enviar los estudios al mail <strong>A DEFINIR</strong>.
                    Desde allí se le indicará cómo continuar con el proceso.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Locación
                </label>

                <select
                  className="w-full border rounded-xl p-3 bg-white"
                  value={form.locacion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      locacion: e.target.value,
                      horario: "",
                    })
                  }
                >
                  <option value="">Seleccione una locación</option>
                  {locaciones.map((locacion) => (
                    <option key={locacion} value={locacion}>
                      {locacion}
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
                  value={form.fecha}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fecha: e.target.value,
                      horario: "",
                    })
                  }
                />
              </div>

              <button
                disabled={
                  !form.nombre ||
                  !form.dni ||
                  !form.mayor65 ||
                  !form.tieneLaboratorioReciente ||
                  !form.locacion ||
                  !form.fecha
                }
                onClick={() => setPaso(2)}
                className="w-full bg-slate-900 text-white rounded-xl p-3 disabled:bg-slate-300"
              >
                Continuar
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <h2 className="text-xl font-semibold">
                2. Elegir horario
              </h2>

              <div className="text-sm text-slate-600 space-y-1">
                <p>
                  Locación seleccionada: <strong>{form.locacion}</strong>
                </p>
                <p>
                  Fecha seleccionada: <strong>{form.fecha}</strong>
                </p>
              </div>

              {cargandoHorarios && (
                <p className="text-sm text-slate-500">
                  Cargando disponibilidad de horarios...
                </p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {horarios.map((hora) => {
                  const estado = estadoHorario(hora);
                  const seleccionado = form.horario === hora;

                  return (
                    <button
                      key={hora}
                      disabled={estado.bloqueado}
                      onClick={() =>
                        setForm({ ...form, horario: hora })
                      }
                      className={`rounded-xl border p-4 text-left ${
                        seleccionado
                          ? "bg-slate-900 text-white"
                          : estado.clases
                      }`}
                    >
                      <div className="font-bold">{hora}</div>
                      <div className="text-xs">{estado.texto}</div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPaso(1)}
                  className="flex-1 border rounded-xl p-3"
                >
                  Volver
                </button>

                <button
                  disabled={!form.horario || cargando}
                  onClick={generarPreReserva}
                  className="flex-1 bg-slate-900 text-white rounded-xl p-3 disabled:bg-slate-300"
                >
                  {cargando ? "Guardando..." : "Generar pre-reserva"}
                </button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-5">
              <h2 className="text-xl font-semibold text-amber-700">
                Pre-reserva generada
              </h2>

              <p>
                Su turno quedó reservado provisoriamente por <strong>1 hora</strong>.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                Para confirmar la reserva debe realizar transferencia bancaria y enviar
                el comprobante indicando DNI.
                <br />
                La confirmación final será realizada manualmente por administración.
              </div>

              <div className="text-sm space-y-1">
                <p><strong>Paciente:</strong> {form.nombre}</p>
                <p><strong>DNI:</strong> {form.dni}</p>
                <p><strong>Locación:</strong> {form.locacion}</p>
                <p><strong>Fecha:</strong> {form.fecha}</p>
                <p><strong>Horario del circuito médico:</strong> {form.horario}</p>
              </div>

              {form.mayor65 === "Sí" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-slate-800 space-y-2">
                  <h3 className="font-semibold text-red-800">
                    Aviso importante para mayores de 65 años
                  </h3>
                  <p>
                    Deberá consultar previamente por WhatsApp al número
                    <strong> A DEFINIR</strong>, ya que debe coordinarse un
                    estudio particular requerido por la Superintendencia de
                    Transporte de la Nación.
                  </p>
                </div>
              )}

              {form.tieneLaboratorioReciente === "Sí" && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-800 space-y-2">
                  <h3 className="font-semibold text-blue-800">
                    Estudios de laboratorio recientes
                  </h3>
                  <p>
                    Usted indicó que posee estudios de laboratorio realizados dentro
                    de los últimos 90 días.
                  </p>
                  <p>
                    Deberá enviarlos al mail <strong>A DEFINIR</strong>. Desde allí
                    se le indicará cómo continuar con el proceso.
                  </p>
                </div>
              )}

              {form.tieneLaboratorioReciente === "No" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-slate-800 space-y-3">
                  <h3 className="font-semibold text-red-800">
                    Información importante para el laboratorio
                  </h3>

                  <p>
                    El estudio de laboratorio se realiza a primera hora, por orden de llegada.
                    Deberá presentarse a las <strong>07:00 hs</strong>.
                  </p>

                  <p>
                    <strong>Dirección del laboratorio:</strong>{" "}
                    {direccionesLaboratorio[form.locacion]}
                  </p>

                  <p>
                    <strong>Indicaciones previas:</strong> deberá presentarse con un
                    ayuno mínimo de <strong>8 horas</strong>, salvo indicación médica diferente.
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  setPaso(1);
                  setForm({
                    nombre: "",
                    dni: "",
                    mayor65: "",
                    tieneLaboratorioReciente: "",
                    locacion: "",
                    fecha: "",
                    horario: "",
                  });
                  setTurnosExistentes([]);
                }}
                className="w-full border rounded-xl p-3"
              >
                Nueva pre-reserva
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}