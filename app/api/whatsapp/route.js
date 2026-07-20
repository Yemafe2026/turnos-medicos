export async function POST(req) {
    try {
        const body = await req.json();

        const telefono = String(body.telefono || "").replace(/\D/g, "");
        const mensaje = String(body.mensaje || "").trim();

        const usarPlantilla = body.usarPlantilla === true;
        const nombrePlantilla = body.nombrePlantilla || "prereserva_turno_medico_v3";
        const idioma = body.idioma || "es_AR";
        const variablesPlantilla = body.variablesPlantilla || [];
        const tokenBoton = body.tokenBoton || "";

        if (!telefono) {
            return Response.json(
                { error: "Falta el número de teléfono." },
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

        let payload;

        if (usarPlantilla) {
            const components = [
                {
                    type: "body",
                    parameters: variablesPlantilla.map((valor) => ({
                        type: "text",
                        text: String(valor || "-")
                            .replace(/\r?\n/g, " ")
                            .replace(/\t/g, " ")
                            .replace(/\s{2,}/g, " ")
                            .trim(),
                    })),
                },
            ];

            if (tokenBoton) {
                components.push({
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        {
                            type: "text",
                            text: String(tokenBoton)
                                .replace(/\r?\n/g, " ")
                                .replace(/\t/g, " ")
                                .replace(/\s{2,}/g, " ")
                                .trim(),
                        },
                    ],
                });
            }

            payload = {
                messaging_product: "whatsapp",
                to: telefono,
                type: "template",
                template: {
                    name: nombrePlantilla,
                    language: {
                        code: idioma,
                    },
                    components,
                },
            };
        } else {
            if (!mensaje) {
                return Response.json(
                    { error: "Falta el mensaje." },
                    { status: 400 }
                );
            }

            payload = {
                messaging_product: "whatsapp",
                to: telefono,
                type: "text",
                text: {
                    preview_url: false,
                    body: mensaje,
                },
            };
        }

        console.log("=== ENVÍO WHATSAPP ===");
        console.log("Payload enviado a Meta:");
        console.log(JSON.stringify(payload, null, 2));

        const metaResponse = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const metaData = await metaResponse.json();

        console.log("=== RESPUESTA META ===");
        console.log("Status:", metaResponse.status);
        console.log(JSON.stringify(metaData, null, 2));

        if (!metaResponse.ok) {
            console.error("=== ERROR META WHATSAPP ===");
            console.error({
                status: metaResponse.status,
                telefono,
                nombrePlantilla,
                idioma,
                variablesPlantilla,
                respuestaMeta: metaData,
            });

            return Response.json(
                {
                    error: "Meta rechazó el envío de WhatsApp.",
                    status: metaResponse.status,
                    detalle: metaData,
                },
                { status: 500 }
            );
        }

        console.log("WhatsApp enviado correctamente.");

        return Response.json({
            ok: true,
            telefono,
            meta: metaData,
        });
    } catch (error) {
        console.error("=== ERROR INESPERADO WHATSAPP ===");
        console.error(error);

        return Response.json(
            {
                error: "Error inesperado enviando WhatsApp.",
                detalle: error.message,
            },
            { status: 500 }
        );
    }
}