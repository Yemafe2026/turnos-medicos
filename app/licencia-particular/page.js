"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const locacion = "Sede Cipolletti";
const direccionCentroMedico = "Alem 257";

const datosPago = {
    alias: "CUENCA.CUADRA.GUSTO",
    titular: "HUINCU MED S.A.S",
};

const horarios = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00",
];

const metodosPagoBase = ["Transferencia"];

function normalizarCelular(valor) {
    return String(valor || "").replace(/\D/g, "");
}

function normalizarTexto(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

function formatearTelefonoWhatsApp(celular) {
    const limpio = String(celular || "").replace(/\D/g, "");

    if (limpio.startsWith("54")) return limpio;

    if (limpio.startsWith("29915")) {
        return `54${limpio}`;
    }

    if (limpio.startsWith("299")) {
        return `5429915${limpio.slice(3)}`;
    }

    if (limpio.startsWith("15")) {
        return `54299${limpio}`;
    }

    return limpio;
}

function obtenerFechaHoraTurno(fecha, horario) {
    return new Date(`${fecha}T${horario}:00`);
}

function faltanMasDe24Horas(fecha, horario) {
    const fechaTurno = obtenerFechaHoraTurno(fecha, horario);
    const ahora = new Date();
    const diferenciaHoras = (fechaTurno - ahora) / 1000 / 60 / 60;
    return diferenciaHoras > 24;
}

function calcularVencimientoPago(fecha, horario) {
    const ahora = new Date();
    const fechaTurno = obtenerFechaHoraTurno(fecha, horario);

    if (faltanMasDe24Horas(fecha, horario)) {
        const vencimiento = new Date(fechaTurno);
        vencimiento.setHours(vencimiento.getHours() - 24);
        return vencimiento.toISOString();
    }

    const vencimiento = new Date(ahora);
    vencimiento.setMinutes(vencimiento.getMinutes() + 60);
    return vencimiento.toISOString();
}

function formatearFechaHora(fechaISO) {
    if (!fechaISO) return "-";

    return new Date(fechaISO).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    });
}

function formatearPlazoPago(fecha, horario, vencimientoISO) {
    if (faltanMasDe24Horas(fecha, horario)) {
        return `hasta ${formatearFechaHora(vencimientoISO)}`;
    }

    return "60 minutos desde la generación de la pre-reserva";
}

async function validarIdentidadPaciente(nombre, dni) {
    const nombreLimpio = nombre.trim();
    const nombreNormalizado = normalizarTexto(nombreLimpio);
    const dniLimpio = String(dni || "").replace(/\D/g, "");

    const { data: registrosPorDni, error: errorDni } = await supabase
        .from("turnos")
        .select("nombre, dni")
        .eq("dni", dniLimpio);

    if (errorDni) {
        console.error(errorDni);
        return {
            valido: false,
            mensaje: "No se pudo validar el DNI del paciente.",
        };
    }

    const conflictoPorDni = registrosPorDni?.find((t) => {
        return (
            String(t.dni || "").replace(/\D/g, "") === dniLimpio &&
            normalizarTexto(t.nombre) !== nombreNormalizado
        );
    });

    if (conflictoPorDni) {
        return {
            valido: false,
            mensaje: `El DNI ${dniLimpio} ya está registrado con otro nombre: ${conflictoPorDni.nombre}. Verifique los datos antes de continuar.`,
        };
    }

    const { data: registrosPorNombre, error: errorNombre } = await supabase
        .from("turnos")
        .select("nombre, dni")
        .ilike("nombre", `%${nombreLimpio}%`);

    if (errorNombre) {
        console.error(errorNombre);
        return {
            valido: false,
            mensaje: "No se pudo validar el nombre del paciente.",
        };
    }

    const conflictoPorNombre = registrosPorNombre?.find((t) => {
        return (
            normalizarTexto(t.nombre) === nombreNormalizado &&
            String(t.dni || "").replace(/\D/g, "") !== dniLimpio
        );
    });

    if (conflictoPorNombre) {
        return {
            valido: false,
            mensaje: `El nombre ${nombreLimpio} ya está registrado con otro DNI: ${conflictoPorNombre.dni}. Verifique los datos antes de continuar.`,
        };
    }

    return {
        valido: true,
        mensaje: "",
    };
}

async function enviarWhatsappPreReserva({
    telefono,
    mensaje,
    variablesPlantilla,
}) {
    const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            telefono: formatearTelefonoWhatsApp(telefono),
            mensaje,
            variablesPlantilla,
        }),
    });

    const data = await response.json();

    if (!response.ok || data?.error) {
        throw new Error(data?.error || "No se pudo enviar WhatsApp");
    }

    return data;
}

export default function LicenciaParticularPage() {
    const [paso, setPaso] = useState(1);
    const [cargando, setCargando] = useState(false);
    const [cargandoHorarios, setCargandoHorarios] = useState(false);
    const [error, setError] = useState("");
    const [turnosExistentes, setTurnosExistentes] = useState([]);

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

    const metodosPagoDisponibles = permiteEfectivo
        ? [...metodosPagoBase, "Efectivo en sucursal"]
        : metodosPagoBase;

    const vencimientoPago =
        form.fecha && form.horario
            ? calcularVencimientoPago(form.fecha, form.horario)
            : "";

    const cargarTurnosExistentes = async () => {
        if (!form.fecha) return;

        setCargandoHorarios(true);
        setError("");

        const { data, error } = await supabase
            .from("turnos")
            .select("*")
            .eq("locacion", locacion)
            .eq("fecha", form.fecha)
            .eq("tipo_turno", "Licencia Particular");

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
    }, [paso, form.fecha]);

    const estadoHorario = (hora) => {
        const turno = turnosExistentes.find((t) => {
            const estado = t.estado || "";
            const estaLiberado =
                estado === "No Confirmado" ||
                estado === "Cancelado" ||
                estado === "Ausente";

            return t.horario === hora && !estaLiberado;
        });

        if (!turno) {
            return {
                texto: "Disponible",
                bloqueado: false,
                clases: "bg-white hover:border-orange-500 hover:bg-orange-50",
            };
        }

        if (turno.estado === "Confirmado") {
            return {
                texto: "Confirmado",
                bloqueado: true,
                clases:
                    "bg-green-100 text-green-800 border-green-300 cursor-not-allowed",
            };
        }

        return {
            texto: "Reservado",
            bloqueado: true,
            clases:
                "bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed",
        };
    };

    const avanzarAPaso2 = async () => {
        try {
            setError("");

            if (
                !form.nombre.trim() ||
                !form.dni.trim() ||
                !form.celular.trim() ||
                !form.fecha
            ) {
                setError("Complete todos los datos antes de continuar.");
                return;
            }

            const celularLimpio = normalizarCelular(form.celular);
            const dniLimpio = String(form.dni || "").replace(/\D/g, "");

            if (celularLimpio.length < 8) {
                setError("Ingrese un número de celular válido.");
                return;
            }

            if (dniLimpio.length < 7) {
                setError("Ingrese un DNI válido.");
                return;
            }

            const validacionIdentidad = await validarIdentidadPaciente(
                form.nombre,
                dniLimpio
            );

            if (!validacionIdentidad.valido) {
                setError(validacionIdentidad.mensaje);
                return;
            }

            setForm({
                ...form,
                nombre: form.nombre.trim(),
                dni: dniLimpio,
                celular: celularLimpio,
            });

            setPaso(2);
        } catch (error) {
            console.error(error);
            setError("Ocurrió un error al validar los datos del paciente.");
        }
    };

    const generarPreReserva = async () => {
        setError("");

        if (!form.horario) {
            setError("Seleccione un horario disponible.");
            return;
        }

        if (!form.metodoPago) {
            setError("Seleccione un método de pago.");
            return;
        }

        const celularLimpio = normalizarCelular(form.celular);
        const vencimiento = calcularVencimientoPago(form.fecha, form.horario);
        const plazoPago = formatearPlazoPago(form.fecha, form.horario, vencimiento);

        setCargando(true);

        const { data: turnoCreado, error } = await supabase
            .from("turnos")
            .insert([
                {
                    tipo_turno: "Licencia Particular",
                    nombre: form.nombre.trim(),
                    dni: form.dni.trim(),
                    celular: celularLimpio,
                    locacion,
                    fecha: form.fecha,
                    horario: form.horario,
                    estado: "Pendiente de pago",
                    pagado: false,
                    metodo_pago: form.metodoPago,
                    vencimiento_pago_at: vencimiento,
                    link_pago: "",
                    qr_pago: "",
                    whatsapp_prereserva_simulado: true,
                    mayor65: "No aplica",
                    laboratorio_reciente: "No aplica",
                },
            ])
            .select()
            .single();

        setCargando(false);

        if (error) {
            console.error(error);
            setError("No se pudo generar la solicitud. Intente nuevamente.");
            return;
        }

        const mensajeParticular = `Pre-reserva recibida.

Paciente: ${form.nombre.trim()}
Trámite: Licencia Particular

Fecha del Turno: ${form.fecha}
Horario del Turno: ${form.horario}
Sede: ${locacion}
Dirección: ${direccionCentroMedico}

Método de pago: ${form.metodoPago}

Datos para transferencia:
Alias: ${datosPago.alias}
Titular: ${datosPago.titular}

Importante: una vez realizada la transferencia, enviá el comprobante por WhatsApp a este mismo número.

El turno se confirmará únicamente luego de recibir y validar el comprobante.

Vencimiento del pago: ${plazoPago}.`;

        const variablesPlantilla = [
            form.nombre.trim(),
            "Licencia Particular",
            form.fecha,
            form.horario,
            locacion,
            direccionCentroMedico,
            form.metodoPago,
            datosPago.alias,
            datosPago.titular,
            plazoPago,
        ];

        try {
            await enviarWhatsappPreReserva({
                telefono: celularLimpio,
                mensaje: mensajeParticular,
                variablesPlantilla,
            });

            if (turnoCreado?.id) {
                await supabase
                    .from("turnos")
                    .update({
                        whatsapp_prereserva_enviado: true,
                        whatsapp_prereserva_error: null,
                    })
                    .eq("id", turnoCreado.id);
            }
        } catch (whatsappError) {
            console.error(whatsappError);

            if (turnoCreado?.id) {
                await supabase
                    .from("turnos")
                    .update({
                        whatsapp_prereserva_enviado: false,
                        whatsapp_prereserva_error: whatsappError.message,
                    })
                    .eq("id", turnoCreado.id);
            }
        }

        setForm({
            ...form,
            celular: celularLimpio,
        });

        setPaso(3);
    };

    const reiniciarFormulario = () => {
        setPaso(1);
        setError("");
        setTurnosExistentes([]);
        setForm({
            nombre: "",
            dni: "",
            celular: "",
            fecha: "",
            horario: "",
            metodoPago: "",
        });
    };

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
                        Turnos Médicos
                    </h1>

                    <p className="text-slate-600">
                        Licencia de Conducir Particular · Cipolletti
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div
                            className={`rounded-xl p-2 ${paso === 1
                                    ? "bg-orange-500 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                        >
                            1. Datos
                        </div>

                        <div
                            className={`rounded-xl p-2 ${paso === 2
                                    ? "bg-orange-500 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                        >
                            2. Horario y pago
                        </div>

                        <div
                            className={`rounded-xl p-2 ${paso === 3
                                    ? "bg-orange-500 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                        >
                            3. Solicitud
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                        {error}
                    </div>
                )}

                {paso === 1 && (
                    <div className="bg-white rounded-2xl p-6 shadow space-y-4">
                        <h2 className="text-xl font-semibold">Datos del solicitante</h2>

                        <input
                            className="w-full border rounded-xl p-3"
                            placeholder="Nombre y apellido"
                            value={form.nombre}
                            onChange={(e) =>
                                setForm({ ...form, nombre: e.target.value })
                            }
                        />

                        <input
                            className="w-full border rounded-xl p-3"
                            placeholder="DNI"
                            value={form.dni}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    dni: e.target.value.replace(/\D/g, ""),
                                })
                            }
                        />

                        <input
                            className="w-full border rounded-xl p-3"
                            placeholder="Celular"
                            value={form.celular}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    celular: normalizarCelular(e.target.value),
                                })
                            }
                        />

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-700">
                            Este turno corresponde únicamente a{" "}
                            <strong>Licencia de Conducir Particular</strong> en la localidad
                            de <strong>Cipolletti</strong>.
                        </div>

                        <input
                            type="date"
                            className="w-full border rounded-xl p-3"
                            value={form.fecha}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    fecha: e.target.value,
                                    horario: "",
                                    metodoPago: "",
                                })
                            }
                        />

                        <button
                            onClick={avanzarAPaso2}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-3"
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {paso === 2 && (
                    <div className="bg-white rounded-2xl p-6 shadow space-y-4">
                        <h2 className="text-xl font-semibold">Elegir horario</h2>

                        <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                            <p>
                                <strong>Tipo:</strong> Licencia Particular
                            </p>
                            <p>
                                <strong>Sede:</strong> {locacion}
                            </p>
                            <p>
                                <strong>Fecha:</strong> {form.fecha}
                            </p>
                        </div>

                        {cargandoHorarios && (
                            <p className="text-sm text-slate-500">
                                Cargando disponibilidad...
                            </p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {horarios.map((hora) => {
                                const estado = estadoHorario(hora);
                                const seleccionado = form.horario === hora;

                                return (
                                    <button
                                        key={hora}
                                        type="button"
                                        disabled={estado.bloqueado}
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                horario: hora,
                                                metodoPago: "",
                                            })
                                        }
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

                        {form.horario && (
                            <div className="bg-white border rounded-2xl p-4 space-y-4">
                                <h3 className="font-semibold">Método de pago</h3>

                                {!permiteEfectivo && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-slate-700">
                                        Como el turno se reserva dentro de las próximas 24 hs, solo
                                        se permite pago por transferencia bancaria. El pago debe
                                        confirmarse dentro de los próximos 60 minutos.
                                    </div>
                                )}

                                {permiteEfectivo && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-slate-700">
                                        Como faltan más de 24 hs para el turno, puede pagar por
                                        transferencia bancaria o en efectivo en sucursal. El pago
                                        debe confirmarse hasta 24 hs antes del turno.
                                    </div>
                                )}

                                <div className="grid gap-3">
                                    {metodosPagoDisponibles.map((metodo) => (
                                        <button
                                            key={metodo}
                                            type="button"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    metodoPago: metodo,
                                                })
                                            }
                                            className={`border rounded-xl p-3 text-left ${form.metodoPago === metodo
                                                    ? "bg-orange-500 text-white border-orange-500"
                                                    : "bg-white"
                                                }`}
                                        >
                                            {metodo}
                                        </button>
                                    ))}
                                </div>

                                {form.metodoPago === "Transferencia" && (
                                    <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                                        <p>
                                            <strong>Alias:</strong> {datosPago.alias}
                                        </p>
                                        <p>
                                            <strong>Titular:</strong> {datosPago.titular}
                                        </p>
                                        <p>
                                            Luego de transferir, administración deberá validar el pago
                                            para confirmar el turno.
                                        </p>
                                    </div>
                                )}

                                {form.metodoPago === "Efectivo en sucursal" && (
                                    <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                                        <p>
                                            Puede abonar en efectivo en la sucursal de Cipolletti
                                            hasta 24 hs antes del turno.
                                        </p>
                                        <p>
                                            <strong>Dirección:</strong> {direccionCentroMedico}
                                        </p>
                                    </div>
                                )}
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
                                disabled={!form.horario || !form.metodoPago || cargando}
                                onClick={generarPreReserva}
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-3 disabled:bg-slate-300"
                            >
                                {cargando ? "Guardando..." : "Solicitar turno"}
                            </button>
                        </div>
                    </div>
                )}

                {paso === 3 && (
                    <div className="bg-white rounded-2xl p-6 shadow space-y-5">
                        <h2 className="text-xl font-semibold text-amber-700">
                            Solicitud generada
                        </h2>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                            Su horario quedó bloqueado provisoriamente.
                            <br />
                            Debe realizar el pago para confirmar definitivamente el turno.
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-3">
                            <h3 className="font-semibold text-green-800">
                                Pago para confirmar el turno
                            </h3>

                            <p>
                                <strong>Método seleccionado:</strong> {form.metodoPago}
                            </p>

                            {permiteEfectivo ? (
                                <p>
                                    El pago debe estar confirmado hasta{" "}
                                    <strong>24 hs antes del turno</strong>.
                                </p>
                            ) : (
                                <p>
                                    Como el turno fue reservado dentro de las próximas 24 hs, el
                                    pago debe confirmarse dentro de los próximos{" "}
                                    <strong>60 minutos</strong>.
                                </p>
                            )}

                            <p>
                                <strong>Vencimiento del pago:</strong>{" "}
                                {formatearFechaHora(vencimientoPago)}
                            </p>

                            {form.metodoPago === "Transferencia" && (
                                <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
                                    <p>
                                        <strong>Alias:</strong> {datosPago.alias}
                                    </p>
                                    <p>
                                        <strong>Titular:</strong> {datosPago.titular}
                                    </p>
                                </div>
                            )}

                            {form.metodoPago === "Efectivo en sucursal" && (
                                <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
                                    <p>Puede abonar en efectivo en la sucursal de Cipolletti.</p>
                                    <p>
                                        <strong>Dirección:</strong> {direccionCentroMedico}
                                    </p>
                                </div>
                            )}

                            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 space-y-3">
                                <div className="text-red-700 font-bold text-lg flex items-center gap-2">
                                    ⚠️ Importante
                                </div>

                                <div className="text-sm text-red-800 space-y-2">
                                    <p>
                                        Una vez realizada la transferencia, deberá enviar el
                                        comprobante de pago vía WhatsApp al mismo número desde el
                                        cual recibirá el mensaje de pre-confirmación.
                                    </p>

                                    <p className="font-semibold">
                                        El turno será confirmado únicamente luego de recibir y
                                        validar el comprobante.
                                    </p>

                                    <p>
                                        Si el comprobante no se recibe antes del vencimiento
                                        informado, la pre-reserva podrá cancelarse automáticamente y
                                        el horario volverá a quedar disponible.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                            <p>
                                <strong>Tipo de turno:</strong> Licencia Particular
                            </p>
                            <p>
                                <strong>Paciente:</strong> {form.nombre}
                            </p>
                            <p>
                                <strong>DNI:</strong> {form.dni}
                            </p>
                            <p>
                                <strong>Celular:</strong> {form.celular}
                            </p>
                            <p>
                                <strong>Sede:</strong> {locacion}
                            </p>
                            <p>
                                <strong>Dirección:</strong> {direccionCentroMedico}
                            </p>
                            <p>
                                <strong>Fecha:</strong> {form.fecha}
                            </p>
                            <p>
                                <strong>Horario:</strong> {form.horario}
                            </p>
                            <p>
                                <strong>Estado:</strong> Pendiente de pago
                            </p>
                        </div>

                        <button
                            onClick={reiniciarFormulario}
                            className="w-full border rounded-xl p-3"
                        >
                            Nueva solicitud
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}