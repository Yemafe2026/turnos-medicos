import ReprogramarClient from "./ReprogramarClient";

export default function Page({ params }) {
    return <ReprogramarClient token={params.token} />;
}