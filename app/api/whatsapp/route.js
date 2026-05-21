const USAR_PLANTILLA_PRERESERVA = false;

function crearPayloadTexto({ telefono, mensaje }) {
    return {
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: {
            preview_url: false,
            body: mensaje,
        },
    };
}

function crearPayloadPlantillaPrereserva({ telefono, variables }) {
    return {
        messaging_product: "whatsapp",
        to: telefono,
        type: "template",
        template: {
            name: "prereserva_turno_medico",
            language: {
                code: "es_AR",
            },
            components: [
                {
                    type: "body",
                    parameters: variables.map((valor) => ({
                        type: "text",
                        text: String(valor || "-"),
                    })),
                },
            ],
        },
    };
}

export async function POST(req) {
    try {
        const body = await req.json();

        const telefono = String(body.telefono || "").replace(/\D/g, "");
        const mensaje = String(body.mensaje || "").trim();
        const variablesPlantilla = body.variablesPlantilla || [];

        if (!telefono) {
            return Response.json(
                { error: "Falta el número de teléfono." },
                { status: 400 }
            );
        }

        if (!USAR_PLANTILLA_PRERESERVA && !mensaje) {
            return Response.json(
                { error: "Falta el mensaje." },
                { status: 400 }
            );
        }

        if (USAR_PLANTILLA_PRERESERVA && variablesPlantilla.length !== 10) {
            return Response.json(
                {
                    error:
                        "Faltan variables para la plantilla prereserva_turno_medico. Deben ser 10.",
                },
                { status: 400 }
            );
        }

        const token = process.env.WHATSAPP_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_ID;

        if (!token) {
            return Response.json(
                { error: "Falta WHATSAPP_TOKEN en Vercel." },
                { status: 500 }
            );
        }

        if (!phoneNumberId) {
            return Response.json(
                { error: "Falta WHATSAPP_PHONE_ID en Vercel." },
                { status: 500 }
            );
        }

        const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

        const payload = USAR_PLANTILLA_PRERESERVA
            ? crearPayloadPlantillaPrereserva({
                telefono,
                variables: variablesPlantilla,
            })
            : crearPayloadTexto({
                telefono,
                mensaje,
            });

        const metaResponse = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const metaData = await metaResponse.json();

        if (!metaResponse.ok) {
            return Response.json(
                {
                    error: "Meta rechazó el envío de WhatsApp.",
                    status: metaResponse.status,
                    detalle: metaData,
                    modo: USAR_PLANTILLA_PRERESERVA ? "plantilla" : "texto",
                },
                { status: 500 }
            );
        }

        return Response.json({
            ok: true,
            telefono,
            modo: USAR_PLANTILLA_PRERESERVA ? "plantilla" : "texto",
            meta: metaData,
        });
    } catch (error) {
        return Response.json(
            {
                error: "Error inesperado enviando WhatsApp.",
                detalle: error.message,
            },
            { status: 500 }
        );
    }
}