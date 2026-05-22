"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

const horariosParticular = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00",
];

const horariosProfesional = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00", "12:20", "12:40",
    "13:00", "13:20", "13:40",
    "14:00",
];

function obtenerHorarios(tipoTurno) {
    if (tipoTurno === "Licencia Particular") return horariosParticular;
    return horariosProfesional;
}

function esHorarioLiberado(estado) {
    return (
        estado === "No Confirmado" ||
        estado === "Cancelado" ||
        estado === "Ausente"
    );
}

export default function ReprogramarTurnoPage({ params }) {
    const token = params.token;

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [turnoOriginal, setTurnoOriginal] = useState(null);
    const [turnosExistentes, setTurnosExistentes] = useState([]);
    const [fecha, setFecha] = useState("");
    const [horario, setHorario] = useState("");
    const [reprogramado, setReprogramado] = useState(false);

    const cargarTurnoOriginal = async () => {
        setCargando(true);
        setError("");

        const { data, error } = await supabase
            .from("turnos")
            .select("*")
            .eq("token_reprogramacion", token)
            .single();

        setCargando(false);

        if (error || !data) {
            setError("No se encontró una reprogramación válida.");
            return;
        }

        if (data.estado !== "Ausente") {
            setError("Este turno no se encuentra habilitado para reprogramación.");
            return;
        }

        setTurnoOriginal(data);
    };

    const cargarTurnosExistentes = async () => {
        if (!turnoOriginal || !fecha) return;

        const { data, error } = await supabase
            .from("turnos")
            .select("*")
            .eq("locacion", turnoOriginal.locacion)
            .eq("fecha", fecha)
            .eq("tipo_turno", turnoOriginal.tipo_turno);

        if (error) {
            console.error(error);
            setError("No se pudieron cargar los horarios disponibles.");
            return;
        }

        setTurnosExistentes(data || []);
    };

    useEffect(() => {
        cargarTurnoOriginal();
    }, []);

    useEffect(() => {
        cargarTurnosExistentes();
    }, [fecha, turnoOriginal]);

    const estadoHorario = (hora) => {
        const ocupado = turnosExistentes.find((t) => {
            return t.horario === hora && !esHorarioLiberado(t.estado);
        });

        if (!ocupado) {
            return {
                texto: "Disponible",
                bloqueado: false,
                clases: "bg-white hover:border-orange-500 hover:bg-orange-50",
            };
        }

        return {
            texto: "Ocupado",
            bloqueado: true,
            clases: "bg-slate-200 text-slate-500 cursor-not-allowed",
        };
    };

    const confirmarReprogramacion = async () => {
        setError("");

        if (!turnoOriginal || !fecha || !horario) {
            setError("Seleccione fecha y horario para reprogramar.");
            return;
        }

        setGuardando(true);

        const { error: insertError } = await supabase.from("turnos").insert([
            {
                tipo_turno: turnoOriginal.tipo_turno,
                nombre: turnoOriginal.nombre,
                dni: turnoOriginal.dni,
                celular: turnoOriginal.celular,
                locacion: turnoOriginal.locacion,
                fecha,
                horario,
                estado: "Reprogramado",
                pagado: true,
                metodo_pago: turnoOriginal.metodo_pago || "Reprogramación",
                comprobante_recibido: true,
                turno_original_id: turnoOriginal.id,
                es_reprogramacion: true,
                penalidad_pendiente: true,
                penalidad_pagada: false,
                penalidad_porcentaje: 30,
                mayor65: turnoOriginal.mayor65 || "No aplica",
                laboratorio_reciente:
                    turnoOriginal.laboratorio_reciente || "No aplica",
            },
        ]);

        if (insertError) {
            console.error(insertError);
            setGuardando(false);
            setError("No se pudo generar la reprogramación.");
            return;
        }

        await supabase
            .from("turnos")
            .update({
                reprogramado_at: new Date().toISOString(),
            })
            .eq("id", turnoOriginal.id);

        setGuardando(false);
        setReprogramado(true);
    };

    if (cargando) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow p-6">
                    Cargando reprogramación...
                </div>
            </main>
        );
    }

    if (error && !turnoOriginal) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow p-6 max-w-xl text-center space-y-3">
                    <h1 className="text-xl font-bold text-red-700">
                        Reprogramación no disponible
                    </h1>
                    <p className="text-slate-600">{error}</p>
                </div>
            </main>
        );
    }

    if (reprogramado) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow p-6 max-w-xl space-y-4 text-center">
                    <img
                        src="/logo.png"
                        alt="Laboral Salud"
                        className="h-20 mx-auto object-contain"
                    />

                    <h1 className="text-2xl font-bold text-green-700">
                        Turno reprogramado
                    </h1>

                    <p className="text-slate-700">
                        Su nuevo horario fue reservado correctamente.
                    </p>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-left">
                        <p>
                            <strong>Importante:</strong> al presentarse en la sede deberá
                            abonar una penalización equivalente al <strong>30%</strong> del
                            valor del estudio antes de iniciar la atención.
                        </p>
                    </div>

                    <div className="bg-slate-50 border rounded-xl p-4 text-sm text-left space-y-1">
                        <p>
                            <strong>Paciente:</strong> {turnoOriginal.nombre}
                        </p>
                        <p>
                            <strong>Trámite:</strong> {turnoOriginal.tipo_turno}
                        </p>
                        <p>
                            <strong>Sede:</strong> {turnoOriginal.locacion}
                        </p>
                        <p>
                            <strong>Fecha:</strong> {fecha}
                        </p>
                        <p>
                            <strong>Horario:</strong> {horario}
                        </p>
                        <p>
                            <strong>Estado:</strong> Reprogramado - penalidad pendiente
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const horarios = obtenerHorarios(turnoOriginal?.tipo_turno);

    return (
        <main className="min-h-screen bg-slate-100 p-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow text-center space-y-4">
                    <img
                        src="/logo.png"
                        alt="Laboral Salud"
                        className="h-24 mx-auto object-contain"
                    />

                    <h1 className="text-3xl font-bold text-slate-800">
                        Reprogramar turno
                    </h1>

                    <p className="text-slate-600">
                        Seleccione un nuevo día y horario disponible.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl p-6 shadow space-y-4">
                    <h2 className="text-xl font-semibold">Datos del turno original</h2>

                    <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                        <p>
                            <strong>Paciente:</strong> {turnoOriginal.nombre}
                        </p>
                        <p>
                            <strong>DNI:</strong> {turnoOriginal.dni}
                        </p>
                        <p>
                            <strong>Trámite:</strong> {turnoOriginal.tipo_turno}
                        </p>
                        <p>
                            <strong>Sede:</strong> {turnoOriginal.locacion}
                        </p>
                        <p>
                            <strong>Turno original:</strong> {turnoOriginal.fecha} ·{" "}
                            {turnoOriginal.horario}
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                        Deberá abonar en la sede una penalización equivalente al{" "}
                        <strong>30%</strong> del valor del estudio antes de iniciar la
                        atención.
                    </div>

                    <input
                        type="date"
                        className="w-full border rounded-xl p-3"
                        value={fecha}
                        onChange={(e) => {
                            setFecha(e.target.value);
                            setHorario("");
                        }}
                    />

                    {fecha && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {horarios.map((hora) => {
                                const estado = estadoHorario(hora);
                                const seleccionado = horario === hora;

                                return (
                                    <button
                                        key={hora}
                                        type="button"
                                        disabled={estado.bloqueado}
                                        onClick={() => setHorario(hora)}
                                        className={`rounded-xl border p-4 text-left transition ${seleccionado
                                                ? "bg-orange-500 text-white border-orange-500"
                                                : estado.clases
                                            }`}
                                    >
                                        <div className="font-bold">{hora}</div>
                                        <div className="text-xs">{estado.texto}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <button
                        disabled={!fecha || !horario || guardando}
                        onClick={confirmarReprogramacion}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-3 disabled:bg-slate-300"
                    >
                        {guardando ? "Guardando..." : "Confirmar reprogramación"}
                    </button>
                </div>
            </div>
        </main>
    );
}