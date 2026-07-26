import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface TopicNode {
  id: string;
  title: string;
  examDomain: string | null;
  status: string;
  children: TopicNode[];
}

function statusDot(status: string) {
  if (status === "completed") return "✅";
  if (status === "in_progress") return "🟡";
  return "⚪";
}

function TopicTree({ cert, nodes }: { cert: string; nodes: TopicNode[] }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link to={`/learn/${cert}/${node.id}`} className="hover:underline">
            {statusDot(node.status)} {node.title}
          </Link>
          {node.children.length > 0 && (
            <ul className="ml-5 mt-1 space-y-1">
              <TopicTree cert={cert} nodes={node.children} />
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Learn() {
  const { cert = "ccaf" } = useParams();
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [percentComplete, setPercentComplete] = useState(0);
  const [certName, setCertName] = useState("");

  useEffect(() => {
    apiFetch(`/courses/${cert}/topics`).then((data) => {
      setTopics(data.topics);
      setPercentComplete(data.percentComplete);
      setCertName(data.certification.name);
    });
  }, [cert]);

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-4">
      <h1 className="text-xl font-semibold">{certName}</h1>
      <p className="text-sm text-gray-600">{percentComplete}% complete</p>
      <TopicTree cert={cert} nodes={topics} />
    </div>
  );
}
