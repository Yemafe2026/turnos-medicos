"use client";

import { useState } from "react";

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
  const [form, setForm] = useState({
    nombre: "",
    dni: "",
    fecha: "",
    horario: "",
  });

  const [turnos, setTurnos] = useState([]);

  const generarPreReserva = () => {
    const nuevoTurno = {
      id: Date.now(),
      ...form,
      estado: "Pendiente",
    };

    setTurnos([nuevoTurno, ...turnos]);
    setPaso(3);
  };

  const confirmarTurno = (id) => {
    setTurnos(
      turnos.map((turno) =>
        turno.id === id ? { ...turno, estado: "Confirmado" } : turno
      )
    );
  };

  const horariosOcupados = turnos
    .filter((t) => t.fecha === form.fecha)
    .map((t) => t.horario);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow">
            <h1 className="text-3xl font-bold text-slate-900">
              Turnos Médicos
            </h1>
            <p className="mt-2 text-slate-600">
              Sistema simple de pre-reserva para certificados médicos de carné profesional.
            </p>
          </div>

          {paso === 1 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <h2 className="text-xl font-semibold">1. Datos del paciente</h2>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre y apellido</label>
                <input
                  className="w-full border rounded-xl p-3"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">DNI</label>
                <input
                  className="w-full border rounded-xl p-3"
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full border rounded-xl p-3"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value, horario: "" })}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-700">
                <strong>Laboratorio:</strong> presentarse a las 07:00 hs por orden de llegada.
                Si posee estudios de laboratorio de hasta 90 días anteriores, enviarlos por mail y esperar confirmación.
              </div>

              <button
                disabled={!form.nombre || !form.dni || !form.fecha}
                onClick={() => setPaso(2)}
                className="w-full bg-slate-900 text-white rounded-xl p-3 disabled:bg-slate-300"
              >
                Continuar
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <h2 className="text-xl font-semibold">2. Elegir horario</h2>

              <p className="text-sm text-slate-600">
                Fecha seleccionada: <strong>{form.fecha}</strong>
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {horarios.map((hora) => {
                  const ocupado = horariosOcupados.includes(hora);

                  return (
                    <button
                      key={hora}
                      disabled={ocupado}
                      onClick={() => setForm({ ...form, horario: hora })}
                      className={`rounded-xl border p-4 text-left ${
                        form.horario === hora
                          ? "bg-slate-900 text-white"
                          : ocupado
                          ? "bg-slate-200 text-slate-400"
                          : "bg-white hover:border-slate-900"
                      }`}
                    >
                      <div className="font-bold">{hora}</div>
                      <div className="text-xs">
                        {ocupado ? "No disponible" : "Disponible"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPaso(1)}
                  className="flex-1 border rounded-xl p-3"
                >
                  Volver
                </button>

                <button
                  disabled={!form.horario}
                  onClick={generarPreReserva}
                  className="flex-1 bg-slate-900 text-white rounded-xl p-3 disabled:bg-slate-300"
                >
                  Generar pre-reserva
                </button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <h2 className="text-xl font-semibold text-amber-700">
                Pre-reserva generada
              </h2>

              <p>
                Su turno quedó reservado provisoriamente por <strong>1 hora</strong>.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                Para confirmar la reserva debe realizar transferencia bancaria y enviar
                el comprobante indicando DNI. La confirmación final será realizada
                manualmente por administración.
              </div>

              <div className="text-sm space-y-1">
                <p><strong>Paciente:</strong> {form.nombre}</p>
                <p><strong>DNI:</strong> {form.dni}</p>
                <p><strong>Fecha:</strong> {form.fecha}</p>
                <p><strong>Horario:</strong> {form.horario}</p>
              </div>

              <button
                onClick={() => {
                  setPaso(1);
                  setForm({ nombre: "", dni: "", fecha: "", horario: "" });
                }}
                className="w-full border rounded-xl p-3"
              >
                Nueva pre-reserva
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl p-6 shadow h-fit">
          <h2 className="text-xl font-semibold mb-4">
            Panel recepción
          </h2>

          {turnos.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Todavía no hay pre-reservas cargadas.
            </p>
          ) : (
            <div className="space-y-3">
              {turnos.map((turno) => (
                <div key={turno.id} className="border rounded-xl p-4 text-sm">
                  <div className="font-semibold">{turno.nombre}</div>
                  <div>DNI: {turno.dni}</div>
                  <div>{turno.fecha} - {turno.horario}</div>
                  <div className="mt-2">
                    Estado: <strong>{turno.estado}</strong>
                  </div>

                  {turno.estado === "Pendiente" && (
                    <button
                      onClick={() => confirmarTurno(turno.id)}
                      className="mt-3 w-full bg-green-700 text-white rounded-xl p-2"
                    >
                      Confirmar manualmente
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}