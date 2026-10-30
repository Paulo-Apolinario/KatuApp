export async function loadSections(
  tasks: {
    label: string;
    load: () => Promise<unknown>;
    apply: (value: any) => void;
  }[],
) {
  const results = await Promise.allSettled(tasks.map((task) => task.load()));
  const failures: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") tasks[index].apply(result.value);
    else failures.push(tasks[index].label);
  });
  return failures;
}
