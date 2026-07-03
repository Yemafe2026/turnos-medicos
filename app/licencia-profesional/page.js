"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const locaciones = ["Sede Cipolletti", "Sede Neuquén"];

const IMPORTE_PROFESIONAL_ESTANDAR = 150000;
const IMPORTE_PROFESIONAL_BENEFICIO = 110000;

const condicionesBeneficio = [
    "Personal de Policía de la Provincia de Río Negro",
    "Bombero voluntario",
    "Empleado Municipal de Cipolletti",
    "Ninguno de los anteriores",
];

const direccionesLaboratorio = {
    "Sede Cipolletti": "Laboratorios IDAC; 25 de Mayo 523",
    "Sede Neuquén": "Laboratorios CEIM; Belgrano 1380",
    "Sede Plaza Huincul": "A definir",
};

const horariosLaboratorio = {
    "Sede Cipolletti": "de 07:00 a 10:00 hs",
    "Sede Neuquén": "de 08:00 a 11:00 hs",
    "Sede Plaza Huincul": "horario a definir",
};

const direccionesCentroMedico = {
    "Sede Cipolletti": "Alem 257",
    "Sede Neuquén": "Cristóbal Colón 388",
    "Sede Plaza Huincul": "A definir",
};

const datosPagoPorLocacion = {
    "Sede Cipolletti": {
        alias: "POSE.MARCA.REBAJAR",
        titular: "VANNLOGIC S.A.S",
    },
    "Sede Neuquén": {
        alias: "POSE.MARCA.REBAJAR",
        titular: "VANNLOGIC S.A.S",
    },
};

const horarios = [
    "08:00", "08:20", "08:40",
    "09:00", "09:20", "09:40",
    "10:00", "10:20", "10:40",
    "11:00", "11:20", "11:40",
    "12:00", "12:20",
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
    let limpio = String(celular || "").replace(/\D/g, "");

    if (limpio.startsWith("549")) return limpio;

    if (limpio.startsWith("54")) {
        limpio = limpio.slice(2);
    }

    if (limpio.startsWith("29915")) {
        return `549299${limpio.slice(5)}`;
    }

    if (limpio.startsWith("2999")) {
        return `54${limpio}`;
    }

    if (limpio.startsWith("299")) {
        return `549299${limpio.slice(3)}`;
    }

    if (limpio.startsWith("15")) {
        return `549299${limpio.slice(2)}`;
    }

    return limpio;
}

function formatearImporte(valor) {
    return `$${Number(valor || 0).toLocaleString("es-AR")}`;
}

function calcularImporteServicio(form) {
    if (
        form.locacion === "Sede Cipolletti" &&
        form.condicionBeneficio &&
        form.condicionBeneficio !== "Ninguno de los anteriores"
    ) {
        return IMPORTE_PROFESIONAL_BENEFICIO;
    }

    return IMPORTE_PROFESIONAL_ESTANDAR;
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
    const fechaTurno = obtenerFechaHoraTurno(fecha, horario);

    if (faltanMasDe24Horas(fecha, horario)) {
        const vencimiento = new Date(fechaTurno);
        vencimiento.setHours(vencimiento.getHours() - 24);
        return vencimiento.toISOString();
    }

    const vencimiento = new Date(fechaTurno);
    vencimiento.setHours(vencimiento.getHours() - 1);
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

function esDiaHabil(fecha) {
    if (!fecha) return false;

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const fechaLocal = new Date(anio, mes - 1, dia);
    const diaSemana = fechaLocal.getDay();

    return diaSemana !== 0 && diaSemana !== 6;
}

function esMartesEnCipolletti(fecha, locacion) {
    if (!fecha || !locacion) return false;

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const fechaLocal = new Date(anio, mes - 1, dia);
    const diaSemana = fechaLocal.getDay();

    return (
        diaSemana === 2 &&
        String(locacion).trim().toLowerCase().includes("cipolletti")
    );
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
            usarPlantilla: true,
            nombrePlantilla: "prereserva_turno_medico_v5",
            idioma: "es_AR",
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
        condicionBeneficio: "Ninguno de los anteriores",
        fecha: "",
        horario: "",
        metodoPago: "",
    });

    const datosPago = datosPagoPorLocacion[form.locacion];
    const importeServicio = calcularImporteServicio(form);

    const permiteEfectivo =
        form.fecha && form.horario && faltanMasDe24Horas(form.fecha, form.horario);

    const metodosPagoDisponibles = permiteEfectivo
        ? [...metodosPagoBase, "En Sucursal"]
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
        try {
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

            // NO PERMITIR SÁBADOS NI DOMINGOS
            if (!esDiaHabil(form.fecha)) {
                setError(
                    "Seleccione una fecha de lunes a viernes. No se toman turnos sábados ni domingos."
                );
                return;
            }

            // NO PERMITIR MARTES EN CIPOLLETTI PARA LICENCIA PROFESIONAL
            if (esMartesEnCipolletti(form.fecha, form.locacion)) {
                setError(
                    "No se toman turnos de Licencia Profesional los días martes en la sede Cipolletti. Seleccione otra fecha."
                );
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
        if (esMartesEnCipolletti(form.fecha, form.locacion)) {
            setError(
                "No se toman turnos de Licencia Profesional los días martes en la sede Cipolletti. Seleccione otra fecha."
            );
            return;
        }

        const celularLimpio = normalizarCelular(form.celular);
        const pago = datosPagoPorLocacion[form.locacion];
        const vencimiento = calcularVencimientoPago(form.fecha, form.horario);
        const plazoPago = formatearPlazoPago(form.fecha, form.horario, vencimiento);
        const importeFinal = calcularImporteServicio(form);

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
                    condicion_beneficio: form.condicionBeneficio,
                    importe_servicio: importeFinal,
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

        const mensajeProfesional = `Pre-reserva recibida.

Paciente: ${form.nombre.trim()}
Trámite: Licencia Profesional

Fecha del Turno: ${form.fecha}
Horario del Turno: ${form.horario}
Sede: ${form.locacion}
Dirección: ${direccionesCentroMedico[form.locacion]}

Importe del servicio: ${formatearImporte(importeFinal)}

${form.locacion === "Sede Cipolletti"
                ? `Condición informada: ${form.condicionBeneficio}`
                : ``
            }

${form.tieneLaboratorioReciente === "No"
                ? `Laboratorio: debe presentarse ${horariosLaboratorio[form.locacion]}.
Dirección laboratorio: ${direccionesLaboratorio[form.locacion]}
Indicaciones: ayuno mínimo de 8 horas.`
                : `Laboratorio: usted indicó que posee estudios realizados dentro de los últimos 60 días.`
            }

${form.mayor65 === "Sí"
                ? `Importante: por ser mayor de 65 años, requiere coordinación especial previa.`
                : ``
            }

Método de pago: ${form.metodoPago}

Datos para transferencia:
Alias: ${pago?.alias || ""}
Titular: ${pago?.titular || ""}

IMPORTANTE:
Para enviar comprobantes de pago o realizar consultas, comuníquese con nuestro equipo de atención por WhatsApp al +54 9 299 5281 922.
El turno será confirmado únicamente luego de recibir y validar el comprobante.

Vencimiento del pago: ${plazoPago}.`;
        const avisoMayor65Whatsapp =
            form.mayor65 === "Sí"
                ? "🚨 IMPORTANTE - MAYOR DE 65 AÑOS. Por normativa vigente, las personas mayores de 65 años requieren una evaluación médica y/o documentación complementaria previa a la emisión del certificado. Nuestro equipo administrativo se comunicará para coordinar los pasos necesarios antes de confirmar la continuidad del trámite."
                : "Información adicional no requerida.";

        const informacionLaboratorioWhatsapp =
            form.tieneLaboratorioReciente === "No"
                ? `Laboratorio de análisis clínicos:
Deberá presentarse en el laboratorio correspondiente ${horariosLaboratorio[form.locacion] || "en horario a definir"}.
Recuerde concurrir con ayuno mínimo de 8 horas.`
                : "Laboratorio: usted indicó que posee estudios realizados dentro de los últimos 60 días.";

        const variablesPlantilla = [
            form.nombre.trim(),
            "Licencia Profesional",
            form.fecha,
            form.horario,
            form.locacion,
            direccionesCentroMedico[form.locacion],
            form.metodoPago,
            pago?.alias || "",
            pago?.titular || "",
            plazoPago,
            avisoMayor65Whatsapp,
            informacionLaboratorioWhatsapp,
        ];

        try {
            await enviarWhatsappPreReserva({
                telefono: celularLimpio,
                mensaje: mensajeProfesional,
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
            mayor65: "",
            tieneLaboratorioReciente: "",
            locacion: "",
            condicionBeneficio: "Ninguno de los anteriores",
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
                        Licencia de Conducir Profesional
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className={`rounded-xl p-2 ${paso === 1 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                            1. Datos
                        </div>
                        <div className={`rounded-xl p-2 ${paso === 2 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                            2. Horario y pago
                        </div>
                        <div className={`rounded-xl p-2 ${paso === 3 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
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
                        <h2 className="text-xl font-bold text-slate-950">Datos del solicitante</h2>

                        <input
                            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
                            placeholder="Nombre y apellido"
                            value={form.nombre}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    nombre: e.target.value
                                        .toUpperCase()
                                        .replace(/[^A-ZÁÉÍÓÚÜÑ\s]/g, "")
                                })
                            }
                        />

                        <input
                            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
                            placeholder="DNI"
                            value={form.dni}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    dni: e.target.value.replace(/\D/g, "").slice(0, 8)
                                })
                            }
                        />

                        <input
                            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
                            placeholder="Celular"
                            value={form.celular}
                            onChange={(e) =>
                                setForm({ ...form, celular: normalizarCelular(e.target.value) })
                            }
                        />

                        <div className="bg-white border-2 border-slate-700 rounded-xl p-4 space-y-3">
                            <p className="font-semibold text-slate-950">¿Es mayor de 65 años?</p>
                            <div className="grid grid-cols-2 gap-3">
                                {["Sí", "No"].map((opcion) => (
                                    <button
                                        key={opcion}
                                        type="button"
                                        onClick={() => setForm({ ...form, mayor65: opcion })}
                                        className={`border-2 rounded-xl p-3 font-bold ${form.mayor65 === opcion ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-950 border-slate-700"}`}
                                    >
                                        {opcion}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border-2 border-slate-700 rounded-xl p-4 space-y-3">
                            <p className="font-semibold text-slate-950">
                                ¿Tiene estudios de laboratorio dentro de los últimos 60 días?
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                {["Sí", "No"].map((opcion) => (
                                    <button
                                        key={opcion}
                                        type="button"
                                        onClick={() =>
                                            setForm({ ...form, tieneLaboratorioReciente: opcion })
                                        }
                                        className={`border-2 rounded-xl p-3 font-bold ${form.tieneLaboratorioReciente === opcion ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-950 border-slate-700"}`}
                                    >
                                        {opcion}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <select
                            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 bg-white font-medium"
                            value={form.locacion}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    locacion: e.target.value,
                                    condicionBeneficio:
                                        e.target.value === "Sede Cipolletti"
                                            ? form.condicionBeneficio
                                            : "Ninguno de los anteriores",
                                    horario: "",
                                    metodoPago: "",
                                })
                            }
                        >
                            <option value="">Seleccione sede</option>
                            {locaciones.map((loc) => (
                                <option key={loc} value={loc}>
                                    {loc}
                                </option>
                            ))}
                        </select>

                        {form.locacion === "Sede Cipolletti" && (
                            <div className="bg-white border-2 border-slate-700 rounded-xl p-4 space-y-3">
                                <p className="font-semibold text-slate-950">
                                    ¿Pertenece a alguna de estas instituciones?
                                </p>
                                <div className="grid gap-3">
                                    {condicionesBeneficio.map((opcion) => (
                                        <button
                                            key={opcion}
                                            type="button"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    condicionBeneficio: opcion,
                                                    horario: "",
                                                    metodoPago: "",
                                                })
                                            }
                                            className={`border rounded-xl p-3 text-left ${form.condicionBeneficio === opcion ? "bg-orange-500 text-white border-orange-500" : "bg-white"}`}
                                        >
                                            {opcion}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-slate-700">
                                    El importe del servicio se calculará según la condición informada.
                                </div>
                            </div>
                        )}

                        {form.locacion && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-700">
                                <p>
                                    <strong>Centro médico:</strong>{" "}
                                    {direccionesCentroMedico[form.locacion]}
                                </p>
                                {form.tieneLaboratorioReciente === "No" && (
                                    <p>
                                        <strong>Laboratorio:</strong>{" "}
                                        {direccionesLaboratorio[form.locacion]}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block font-semibold text-slate-950">
                                Seleccionar fecha
                            </label>

                            <input
                                type="date"
                                className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 bg-white font-medium"
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
                        </div>

                        <button
                            onClick={avanzarAPaso2}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-3"
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {paso === 2 && (
                    <div className="bg-white rounded-2xl p-6 shadow space-y-4 text-slate-950">
                        <h2 className="text-xl font-semibold">Elegir horario</h2>

                        <div className="bg-white border-2 border-slate-700 rounded-xl p-4 text-sm text-slate-950 font-medium space-y-1">
                            <p><strong>Tipo de turno:</strong> Licencia Profesional</p>
                            <p><strong>Paciente:</strong> {form.nombre}</p>
                            <p><strong>DNI:</strong> {form.dni}</p>
                            <p><strong>Celular:</strong> {form.celular}</p>
                            <p><strong>Mayor de 65:</strong> {form.mayor65}</p>
                            <p><strong>Laboratorio reciente:</strong> {form.tieneLaboratorioReciente}</p>
                            <p><strong>Sede:</strong> {form.locacion}</p>

                            {form.locacion === "Sede Cipolletti" && (
                                <p><strong>Condición:</strong> {form.condicionBeneficio}</p>
                            )}

                            <p><strong>Fecha:</strong> {form.fecha}</p>
                        </div>

                        {cargandoHorarios && (
                            <p className="text-sm text-slate-700 font-medium">
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
                                        className={`rounded-xl border p-4 text-left transition ${seleccionado ? "bg-orange-500 text-white border-orange-500" : estado.clases}`}
                                    >
                                        <div className="font-bold">{hora}</div>
                                        <div className="text-xs">{estado.texto}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {form.horario && (
                            <div className="bg-white border rounded-2xl p-4 space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                                    <p className="font-semibold text-green-800">
                                        Importe del servicio
                                    </p>
                                    <p className="text-2xl font-bold text-green-900">
                                        {formatearImporte(importeServicio)}
                                    </p>
                                </div>

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
                                                setForm({ ...form, metodoPago: metodo })
                                            }
                                            className={`border rounded-xl p-3 text-left ${form.metodoPago === metodo ? "bg-orange-500 text-white border-orange-500" : "bg-white"}`}
                                        >
                                            {metodo}
                                        </button>
                                    ))}
                                </div>

                                {form.metodoPago === "Transferencia" && datosPago && (
                                    <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                                        <p><strong>Alias:</strong> {datosPago.alias}</p>
                                        <p><strong>Titular:</strong> {datosPago.titular}</p>
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
                        {form.mayor65 === "Sí" && (
                            <div className="bg-red-200 border-2 border-red-600 rounded-2xl p-5 text-sm space-y-2">
                                <div className="text-red-900 font-bold text-lg">
                                    🚨 IMPORTANTE - MAYOR DE 65 AÑOS
                                </div>

                                <p className="text-red-950 font-medium">
                                    Por normativa vigente, las personas mayores de 65 años requieren
                                    una evaluación médica y/o documentación complementaria previa a la
                                    emisión del certificado.
                                </p>

                                <p className="text-red-950 font-semibold">
                                    Nuestro equipo administrativo se comunicará para coordinar los pasos
                                    necesarios antes de confirmar la continuidad del trámite.
                                </p>
                            </div>
                        )}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-3">
                            <h3 className="font-semibold text-green-800">
                                Pago para confirmar el turno
                            </h3>

                            <p>
                                <strong>Importe del servicio:</strong>{" "}
                                {formatearImporte(importeServicio)}
                            </p>

                            <p>
                                <strong>Método seleccionado:</strong> {form.metodoPago}
                            </p>

                            <p>
                                <strong>Vencimiento del pago:</strong>{" "}
                                {formatearFechaHora(vencimientoPago)}
                            </p>

                            {form.metodoPago === "Transferencia" && datosPago && (
                                <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
                                    <p><strong>Alias:</strong> {datosPago.alias}</p>
                                    <p><strong>Titular:</strong> {datosPago.titular}</p>
                                </div>
                            )}

                            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 space-y-3">
                                <div className="text-red-700 font-bold text-lg">
                                    ⚠️ Importante
                                </div>

                                <div className="text-sm text-red-800 space-y-2">
                                    <p>
                                        Para enviar comprobantes de pago o realizar consultas,
                                        comuníquese con nuestro equipo de atención por WhatsApp al{" "}
                                        <strong>+54 9 299 5281 922</strong>.
                                    </p>

                                    <p className="font-semibold text-slate-950">
                                        El turno será confirmado únicamente luego de recibir y validar
                                        el comprobante.
                                    </p>

                                    <p>
                                        Si el comprobante no se recibe antes del vencimiento
                                        informado, la pre-reserva podrá cancelarse automáticamente y
                                        el horario volverá a quedar disponible.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {form.tieneLaboratorioReciente === "No" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1">
                                <h3 className="font-semibold text-blue-800">
                                    Indicaciones de laboratorio
                                </h3>
                                <p>
                                    Debe presentarse <strong>{horariosLaboratorio[form.locacion]}</strong>.
                                </p>
                                <p>
                                    <strong>Dirección:</strong>{" "}
                                    {direccionesLaboratorio[form.locacion]}
                                </p>
                                <p>
                                    <strong>Indicaciones:</strong> ayuno mínimo de 8 horas.
                                </p>
                            </div>
                        )}

                        {form.tieneLaboratorioReciente === "Sí" && (
                            <div className="bg-green-50 border-2 border-green-600 rounded-xl p-4 text-sm text-slate-950 font-medium">
                                Deberá presentar los estudios de laboratorio realizados dentro
                                de los últimos 60 días.
                            </div>
                        )}

                        <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-1">
                            <p><strong>Tipo de turno:</strong> Licencia Profesional</p>
                            <p><strong>Paciente:</strong> {form.nombre}</p>
                            <p><strong>DNI:</strong> {form.dni}</p>
                            <p><strong>Celular:</strong> {form.celular}</p>
                            <p><strong>Mayor de 65:</strong> {form.mayor65}</p>
                            <p>
                                <strong>Laboratorio reciente:</strong>{" "}
                                {form.tieneLaboratorioReciente}
                            </p>
                            <p><strong>Sede:</strong> {form.locacion}</p>
                            {form.locacion === "Sede Cipolletti" && (
                                <p>
                                    <strong>Condición informada:</strong>{" "}
                                    {form.condicionBeneficio}
                                </p>
                            )}
                            <p>
                                <strong>Importe:</strong>{" "}
                                {formatearImporte(importeServicio)}
                            </p>
                            <p>
                                <strong>Dirección:</strong>{" "}
                                {direccionesCentroMedico[form.locacion]}
                            </p>
                            <p><strong>Fecha:</strong> {form.fecha}</p>
                            <p><strong>Horario:</strong> {form.horario}</p>
                            <p><strong>Estado:</strong> Pendiente de pago</p>
                        </div>

                        <button
                            onClick={reiniciarFormulario}
                            className="w-full border-2 border-slate-700 rounded-xl p-3 text-slate-950 placeholder:text-slate-700 bg-white font-medium"
                        >
                            Nueva solicitud
                        </button>
                    </div>
                )}
            </div>
        </main >
    );
}