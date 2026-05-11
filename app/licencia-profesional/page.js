"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const locaciones = [
    "Sede Cipolletti",
    "Sede Neuquén",
    "Sede Plaza Huincul",
];

const direccionesLaboratorio = {
    "Sede Cipolletti": "25 de Mayo 525",
    "Sede Neuquén": "DIRECCION_LABORATORIO_NEUQUEN_A_DEFINIR",
    "Sede Plaza Huincul": "DIRECCION_LABORATORIO_PLAZAHUINCUL_A_DEFINIR",
};

const direccionesCentroMedico = {
    "Sede Cipolletti": "Alem 257",
    "Sede Neuquén": "Colón 338",
    "Sede Plaza Huincul": "DIRECCION_CENTRO_MEDICO_PLAZAHUINCUL_A_DEFINIR",
};

const datosPagoPorLocacion = {
    "Sede Cipolletti": {
        alias: "CUENCA.CUADRA.GUSTO",
        titular: "HUINCU MED S.A.S",
    },
    "Sede Neuquén": {
        alias: "POSE.MARCA.REBAJAR",
        titular: "VANNLOGIC S.A.S",
    },
    "Sede Plaza Huincul": {
        alias: "POSE.MARCA.REBAJAR",
        titular: "VANNLOGIC S.A.S",
    },
};

const horarios = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00", "12:20", "12:40",
    "13:00", "13:20", "13:40",
    "14:00",
];

const metodosPagoBase = ["Transferencia"];

function normalizarCelular(valor) {
    return valor.replace(/\D/g, "");
}

function formatearTelefonoWhatsApp(celular) {
    const limpio = String(celular || "").replace(/\D/g, "");
    if (limpio.startsWith("549")) return limpio;
    if (limpio.startsWith("54")) return `549${limpio.slice(2)}`;
    return `549${limpio}`;
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

async function enviarWhatsappPreReserva({ telefono, mensaje }) {
    const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            telefono: formatearTelefonoWhatsApp(telefono),
            mensaje,
        }),
    });

    const data = await response.json();

    if (!response.ok || data?.error) {
        throw new Error(data?.error || "No se pudo enviar WhatsApp");
    }

    return data;
}

export default function LicenciaProfesionalPage() {
    const [paso, setPaso] = useState(1);
    const [cargando, setCargando] = useState(false);
    const [cargandoHorarios, setCargandoHorarios] = useState(false);
    const [error, setError] = useState("");
    const [turnosExistentes, setTurnosExistentes] = useState([]);

    const [form, setForm] = useState({
        nombre: "",
        dni: "",
        celular: "",
        mayor65: "",
        tieneLaboratorioReciente: "",
        locacion: "",
        fecha: "",
        horario: "",
        metodoPago: "",
    });

    const datosPago = datosPagoPorLocacion[form.locacion];

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
        if (!form.locacion || !form.fecha) return;

        setCargandoHorarios(true);
        setError("");

        const { data, error } = await supabase
            .from("turnos")
            .select("*")
            .eq("locacion", form.locacion)
            .eq("fecha", form.fecha)
            .eq("tipo_turno", "Carnet Profesional");

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
        setError("");

        if (
            !form.nombre.trim() ||
            !form.dni.trim() ||
            !form.celular.trim() ||
            !form.mayor65 ||
            !form.tieneLaboratorioReciente ||
            !form.locacion ||
            !form.fecha
        ) {
            setError("Complete todos los datos antes de continuar.");
            return;
        }

        const celularLimpio = normalizarCelular(form.celular);
        const dniLimpio = String(form.dni || "").replace(/\D/g, "");

        if (dniLimpio.length < 7) {
            setError("Ingrese un DNI válido.");
            return;
        }

        if (celularLimpio.length < 8) {
            setError("Ingrese un número de celular válido.");
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
        const pago = datosPagoPorLocacion[form.locacion];
        const vencimiento = calcularVencimientoPago(form.fecha, form.horario);

        setCargando(true);

        const { data: turnoCreado, error } = await supabase
            .from("turnos")
            .insert([
                {
                    tipo_turno: "Carnet Profesional",
                    nombre: form.nombre.trim(),
                    dni: form.dni.trim(),
                    celular: celularLimpio,
                    mayor65: form.mayor65,
                    laboratorio_reciente: form.tieneLaboratorioReciente,
                    locacion: form.locacion,
                    fecha: form.fecha,
                    horario: form.horario,
                    estado: "Pendiente de pago",
                    pagado: false,
                    metodo_pago: form.metodoPago,
                    vencimiento_pago_at: vencimiento,
                    link_pago: "",
                    qr_pago: "",
                    whatsapp_prereserva_simulado: true,
                },
            ])
            .select()
            .single();

        setCargando(false);

        if (error) {
            console.error(error);
            setError("No se pudo generar la pre-reserva. Intente nuevamente.");
            return;
        }

        const mensajeProfesional = `Hola ${form.nombre.trim()}, recibimos tu pre-reserva para Licencia de Conducir Profesional.

Fecha: ${form.fecha}
Horario centro médico: ${form.horario}
Sede: ${form.locacion}
Dirección centro médico: ${direccionesCentroMedico[form.locacion]}

${form.tieneLaboratorioReciente === "No"
                ? `Laboratorio: debe presentarse a las 07:00 hs.
Dirección laboratorio: ${direccionesLaboratorio[form.locacion]}
Indicaciones: ayuno mínimo de 8 horas.`
                : `Laboratorio: usted indicó que posee estudios realizados dentro de los últimos 90 días.`
            }

${form.mayor65 === "Sí"
                ? `Importante: por ser mayor de 65 años, requiere coordinación especial previa.`
                : ``
            }

Método de pago seleccionado: ${form.metodoPago}

Datos para transferencia:
Alias: ${pago?.alias || ""}
Titular: ${pago?.titular || ""}

Vencimiento del pago: ${formatearFechaHora(vencimiento)}

Una vez realizado el pago, será validado por administración.

Si el pago no se confirma antes del vencimiento indicado, la pre-reserva podrá ser liberada automáticamente.`;

        try {
            await enviarWhatsappPreReserva({
                telefono: celularLimpio,
                mensaje: mensajeProfesional,
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
            mayor65: "",
            tieneLaboratorioReciente: "",
            locacion: "",
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
                        Licencia de Conducir Profesional
                    </h1>

                    <p className="text-slate-600">
                        Sistema de pre-reserva para certificaciones médicas laborales.
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
                            3. Pre-reserva
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
                        <h2 className="text-xl font-semibold">Datos del paciente</h2>

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

                        <select
                            className="w-full border rounded-xl p-3 bg-white"
                            value={form.mayor65}
                            onChange={(e) =>
                                setForm({ ...form, mayor65: e.target.value })
                            }
                        >
                            <option value="">¿Tiene 65 años o más?</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                        </select>

                        {form.mayor65 === "Sí" && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-700">
                                Antes de continuar, deberá consultar previamente por WhatsApp,
                                ya que debe coordinarse un estudio particular requerido por la
                                Superintendencia de Transporte de la Nación.
                            </div>
                        )}

                        <select
                            className="w-full border rounded-xl p-3 bg-white"
                            value={form.tieneLaboratorioReciente}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    tieneLaboratorioReciente: e.target.value,
                                })
                            }
                        >
                            <option value="">
                                ¿Tiene estudios de laboratorio dentro de los últimos 90 días?
                            </option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                        </select>

                        {form.tieneLaboratorioReciente === "Sí" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-700">
                                Deberá enviar los estudios al mail{" "}
                                <strong>A DEFINIR</strong>. Desde allí se le indicará cómo
                                continuar con el proceso.
                            </div>
                        )}

                        <select
                            className="w-full border rounded-xl p-3 bg-white"
                            value={form.locacion}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    locacion: e.target.value,
                                    horario: "",
                                    metodoPago: "",
                                })
                            }
                        >
                            <option value="">Seleccione sede</option>
                            {locaciones.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>

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
                                <strong>Tipo:</strong> Licencia Profesional
                            </p>
                            <p>
                                <strong>Sede:</strong> {form.locacion}
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

                                {form.metodoPago === "Transferencia" && datosPago && (
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
                                            Puede abonar en efectivo en la sucursal seleccionada hasta
                                            24 hs antes del turno.
                                        </p>
                                        <p>
                                            <strong>Dirección:</strong>{" "}
                                            {direccionesCentroMedico[form.locacion]}
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

                            {form.metodoPago === "Transferencia" && datosPago && (
                                <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
                                    <p>
                                        <strong>Alias:</strong> {datosPago.alias}
                                    </p>
                                    <p>
                                        <strong>Titular:</strong> {datosPago.titular}
                                    </p>
                                    <p>
                                        Luego de realizar la transferencia, envíe el comprobante
                                        indicando nombre, DNI, fecha y horario del turno.
                                    </p>
                                </div>
                            )}

                            {form.metodoPago === "Efectivo en sucursal" && (
                                <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
                                    <p>
                                        Puede abonar en efectivo en la sucursal seleccionada.
                                    </p>
                                    <p>
                                        <strong>Dirección:</strong>{" "}
                                        {direccionesCentroMedico[form.locacion]}
                                    </p>
                                    <p>
                                        Recuerde que el pago debe realizarse hasta 24 hs antes del
                                        turno.
                                    </p>
                                </div>
                            )}

                            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 space-y-3">
                                <div className="text-red-700 font-bold text-lg flex items-center gap-2">
                                    ⚠️ Importante
                                </div>

                                <div className="text-sm text-red-800 space-y-2">
                                    <p>
                                        Una vez realizada la transferencia, deberá enviar el comprobante
                                        de pago vía WhatsApp al mismo número desde el cual recibirá el
                                        mensaje de pre-confirmación.
                                    </p>

                                    <p className="font-semibold">
                                        El turno será confirmado únicamente luego de recibir y validar el comprobante.
                                    </p>

                                    <p>
                                        Si el comprobante no se recibe antes del vencimiento informado,
                                        la pre-reserva podrá cancelarse automáticamente y el horario
                                        volverá a quedar disponible.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                            <p>
                                <strong>Tipo de turno:</strong> Licencia Profesional
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
                                <strong>Fecha:</strong> {form.fecha}
                            </p>
                            <p>
                                <strong>Horario centro médico:</strong> {form.horario}
                            </p>
                            <p>
                                <strong>Sede:</strong> {form.locacion}
                            </p>
                            <p>
                                <strong>Dirección centro médico:</strong>{" "}
                                {direccionesCentroMedico[form.locacion]}
                            </p>

                            {form.tieneLaboratorioReciente === "No" && (
                                <>
                                    <p>
                                        <strong>Laboratorio:</strong> 07:00 hs
                                    </p>
                                    <p>
                                        <strong>Dirección laboratorio:</strong>{" "}
                                        {direccionesLaboratorio[form.locacion]}
                                    </p>
                                    <p>
                                        <strong>Ayuno mínimo:</strong> 8 horas
                                    </p>
                                </>
                            )}

                            {form.tieneLaboratorioReciente === "Sí" && (
                                <p>
                                    <strong>Laboratorio:</strong> Usted indicó que posee estudios
                                    realizados dentro de los últimos 90 días.
                                </p>
                            )}

                            {form.mayor65 === "Sí" && (
                                <p className="text-red-700 font-medium">
                                    Atención: requiere coordinación especial previa por ser mayor
                                    de 65 años.
                                </p>
                            )}

                            <p>
                                <strong>Estado:</strong> Pendiente de pago
                            </p>
                        </div>

                        <button
                            onClick={reiniciarFormulario}
                            className="w-full border rounded-xl p-3"
                        >
                            Nueva pre-reserva
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}