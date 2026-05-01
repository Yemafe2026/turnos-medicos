"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const locacion = "Sede Cipolletti";

const direccionCentroMedico =
    "DIRECCION_CENTRO_MEDICO_CIPOLLETTI_A_DEFINIR";

const datosPago = {
    alias: "ALIAS_CIPOLLETTI_A_DEFINIR",
    titular: "TITULAR_CIPOLLETTI_A_DEFINIR",
    linkMercadoPago: "LINK_MP_CIPOLLETTI_A_DEFINIR",
};

const horarios = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00",
];

const metodosPagoBase = ["Mercado Pago", "Transferencia"];

function normalizarCelular(valor) {
    return valor.replace(/\D/g, "");
}

function formatearTelefonoWhatsApp(celular) {
    const limpio = celular.replace(/\D/g, "");
    if (limpio.startsWith("549")) return limpio;
    return `549${limpio}`;
}

function obtenerFechaHoraTurno(fecha, horario) {
    return new Date(`${fecha}T${horario}:00`);
}

function faltanMasDe24Horas(fecha, horario) {
    const fechaTurno = obtenerFechaHoraTurno(fecha, horario);
    const ahora = new Date();
    return (fechaTurno - ahora) / 1000 / 60 / 60 > 24;
}

function calcularVencimientoPago(fecha, horario) {
    const ahora = new Date();
    const turno = obtenerFechaHoraTurno(fecha, horario);

    if (faltanMasDe24Horas(fecha, horario)) {
        const v = new Date(turno);
        v.setHours(v.getHours() - 24);
        return v.toISOString();
    }

    const v = new Date(ahora);
    v.setMinutes(v.getMinutes() + 60);
    return v.toISOString();
}

export default function Page() {
    const [paso, setPaso] = useState(1);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [turnos, setTurnos] = useState([]);

    const [form, setForm] = useState({
        nombre: "",
        dni: "",
        celular: "",
        fecha: "",
        horario: "",
        metodoPago: "",
    });

    const permiteEfectivo =
        form.fecha && form.horario && faltanMasDe24Horas(form.fecha, form.horario);

    const metodosPago = permiteEfectivo
        ? [...metodosPagoBase, "Efectivo en sucursal"]
        : metodosPagoBase;

    const cargarTurnos = async () => {
        const { data } = await supabase
            .from("turnos")
            .select("*")
            .eq("locacion", locacion)
            .eq("fecha", form.fecha)
            .eq("tipo_turno", "Licencia Particular");

        setTurnos(data || []);
    };

    useEffect(() => {
        if (paso === 2) cargarTurnos();
    }, [paso, form.fecha]);

    const estadoHorario = (hora) => {
        const ocupado = turnos.find((t) => t.horario === hora);
        return ocupado ? "Reservado" : "Disponible";
    };

    const generar = async () => {
        setError("");

        if (!form.horario || !form.metodoPago) {
            setError("Complete todos los campos.");
            return;
        }

        const celular = normalizarCelular(form.celular);
        const vencimiento = calcularVencimientoPago(form.fecha, form.horario);

        setCargando(true);

        const { data: turno, error } = await supabase
            .from("turnos")
            .insert([
                {
                    tipo_turno: "Licencia Particular",
                    nombre: form.nombre,
                    dni: form.dni,
                    celular,
                    locacion,
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
            setError("Error al guardar");
            setCargando(false);
            return;
        }

        // 🔥 WHATSAPP AUTOMÁTICO
        try {
            await fetch("/api/whatsapp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    telefono: formatearTelefonoWhatsApp(celular),
                    mensaje: `Hola ${form.nombre}

Pre-reserva registrada:

📍 ${locacion}
📅 ${form.fecha}
⏰ ${form.horario}

Dirección:
${direccionCentroMedico}

Método de pago: ${form.metodoPago}

⚠ Tenés tiempo limitado para pagar o el turno se libera.`,
                }),
            });
        } catch (e) {
            console.error("WhatsApp error", e);
        }

        setPaso(3);
        setCargando(false);
    };

    return (
        <main className="p-6 bg-slate-100 min-h-screen">
            <div className="max-w-xl mx-auto space-y-4">

                <h1 className="text-2xl font-bold text-center">
                    Licencia Particular
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

                        <input type="date"
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })} />

                        <button onClick={() => setPaso(2)}>Continuar</button>
                    </>
                )}

                {paso === 2 && (
                    <>
                        {horarios.map(h => (
                            <button key={h}
                                disabled={estadoHorario(h) === "Reservado"}
                                onClick={() => setForm({ ...form, horario: h })}>
                                {h}
                            </button>
                        ))}

                        {form.horario && (
                            <>
                                {metodosPago.map(m => (
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
                    <div>Turno generado correctamente</div>
                )}

            </div>
        </main>
    );
}