"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const locaciones = [
    "Sede Cipolletti",
    "Sede Neuquén",
    "Sede Plaza Huincul",
];

const direccionesCentro = {
    "Sede Cipolletti": "DIRECCION_CENTRO_CIPOLLETTI",
    "Sede Neuquén": "DIRECCION_CENTRO_NEUQUEN",
    "Sede Plaza Huincul": "DIRECCION_CENTRO_PLAZA",
};

const horarios = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00"
];

function normalizarCelular(v) {
    return v.replace(/\D/g, "");
}

function formatWhatsApp(cel) {
    const limpio = cel.replace(/\D/g, "");
    if (limpio.startsWith("549")) return limpio;
    return `549${limpio}`;
}

function calcularVencimiento(fecha, hora) {
    const ahora = new Date();
    const turno = new Date(`${fecha}T${hora}:00`);
    const diff = (turno - ahora) / 1000 / 60 / 60;

    if (diff > 24) {
        turno.setHours(turno.getHours() - 24);
        return turno.toISOString();
    }

    const v = new Date();
    v.setMinutes(v.getMinutes() + 60);
    return v.toISOString();
}

export default function Page() {
    const [paso, setPaso] = useState(1);
    const [error, setError] = useState("");
    const [turnos, setTurnos] = useState([]);

    const [form, setForm] = useState({
        nombre: "",
        dni: "",
        celular: "",
        mayor65: "",
        laboratorio: "",
        locacion: "",
        fecha: "",
        horario: "",
        metodoPago: "",
    });

    const cargarTurnos = async () => {
        const { data } = await supabase
            .from("turnos")
            .select("*")
            .eq("locacion", form.locacion)
            .eq("fecha", form.fecha)
            .eq("tipo_turno", "Carnet Profesional");

        setTurnos(data || []);
    };

    useEffect(() => {
        if (paso === 2) cargarTurnos();
    }, [paso, form.fecha, form.locacion]);

    const ocupado = (h) =>
        turnos.find((t) => t.horario === h);

    const generar = async () => {
        if (!form.horario || !form.metodoPago) {
            setError("Faltan datos");
            return;
        }

        const celular = normalizarCelular(form.celular);
        const vencimiento = calcularVencimiento(form.fecha, form.horario);

        const { data, error } = await supabase
            .from("turnos")
            .insert([
                {
                    tipo_turno: "Carnet Profesional",
                    nombre: form.nombre,
                    dni: form.dni,
                    celular,
                    locacion: form.locacion,
                    fecha: form.fecha,
                    horario: form.horario,
                    estado: "Pendiente de pago",
                    metodo_pago: form.metodoPago,
                    vencimiento_pago_at: vencimiento,
                },
            ])
            .select()
            .single();

        if (error) {
            setError("Error guardando");
            return;
        }

        // 🔥 WHATSAPP
        try {
            await fetch("/api/whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telefono: formatWhatsApp(celular),
                    mensaje: `Hola ${form.nombre}

Pre-reserva profesional:

📍 ${form.locacion}
📅 ${form.fecha}
⏰ ${form.horario}

Dirección:
${direccionesCentro[form.locacion]}

Método de pago: ${form.metodoPago}

⚠ Debe completar el pago para confirmar el turno.`,
                }),
            });
        } catch (e) {
            console.error("WA error", e);
        }

        setPaso(3);
    };

    return (
        <main className="p-6 bg-slate-100 min-h-screen">
            <div className="max-w-xl mx-auto space-y-4">

                <h1 className="text-2xl font-bold text-center">
                    Licencia Profesional
                </h1>

                {error && <div className="text-red-500">{error}</div>}

                {paso === 1 && (
                    <>
                        <input placeholder="Nombre"
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })} />

                        <input placeholder="DNI"
                            onChange={(e) => setForm({ ...form, dni: e.target.value })} />

                        <input placeholder="Celular"
                            onChange={(e) => setForm({ ...form, celular: e.target.value })} />

                        <select onChange={(e) => setForm({ ...form, locacion: e.target.value })}>
                            <option>Seleccionar sede</option>
                            {locaciones.map(l => <option key={l}>{l}</option>)}
                        </select>

                        <input type="date"
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })} />

                        <button onClick={() => setPaso(2)}>Continuar</button>
                    </>
                )}

                {paso === 2 && (
                    <>
                        {horarios.map(h => (
                            <button key={h}
                                disabled={ocupado(h)}
                                onClick={() => setForm({ ...form, horario: h })}>
                                {h}
                            </button>
                        ))}

                        {form.horario && (
                            <>
                                {["Mercado Pago", "Transferencia"].map(m => (
                                    <button key={m}
                                        onClick={() => setForm({ ...form, metodoPago: m })}>
                                        {m}
                                    </button>
                                ))}

                                <button onClick={generar}>
                                    Confirmar
                                </button>
                            </>
                        )}
                    </>
                )}

                {paso === 3 && (
                    <div className="text-center font-semibold">
                        Turno generado correctamente
                    </div>
                )}

            </div>
        </main>
    );
}