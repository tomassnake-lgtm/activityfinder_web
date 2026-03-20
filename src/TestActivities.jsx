import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function TestActivities() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("activities").select("*");
      if (error) {
        console.error("Error:", error);
      } else {
        setActivities(data);
      }
    };

    load();
  }, []);

  return (
    <div>
      <h1>Activities</h1>
      {activities.map(a => (
        <div key={a.id}>
          <h2>{a.title}</h2>
          <p>{a.description}</p>
        </div>
      ))}
    </div>
  );
}