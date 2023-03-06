import { proxy, subscribe } from "valtio";
import { subscribeKey } from "valtio/utils";
import { CPU } from "./CPU";
import { Process } from "./Process";
import { Queue } from "./Queue";

export const createSJFWithW = ({ cpu }: { cpu: CPU }): Queue => {
  const state = proxy({
    processes: [] as Process[],
    doneProcesses: [] as Process[],
    isRunning: false,
    currentProcess: null as Process | null,
    interval: null as NodeJS.Timer | null,
    subscriptions: [] as (() => void)[],
    cpu,
    addProcess(process: Process) {
      state.processes.push(process);
      state.processes.sort((a, b) => a.length - b.length);
    },

    getProcesses() {
      return state.processes;
    },

    getAverageWaitingTime() {
      const sum = state.doneProcesses.reduce(
        (acc, process) => acc + process.waitingTime,
        0
      );

      return sum / state.doneProcesses.length;
    },

    consumeProcess: () => {
      if (!state.currentProcess || state.currentProcess.isDone()) {
        const process = state.processes.shift() ?? null;

        state.currentProcess = process;
      }

      cpu.setCurrentProcess(state.currentProcess);
    },

    startQueue: () => {
      state.isRunning = true;

      state.interval = setInterval(() => {
        state.processes.forEach((process) => {
          process.waitingTime += 0.2;
        });
      }, 200);

      cpu.start((process) => {
        state.doneProcesses.push(process);
        state.consumeProcess();
      });

      const subscription = subscribe(state.processes, () => {
        if (state.processes.length > 0 && state.currentProcess === null) {
          state.consumeProcess();
        }

        const newProcess = state.processes.at(0) ?? null;

        if (!newProcess) {
          return;
        }

        if (
          state.currentProcess &&
          newProcess.length < state.currentProcess?.length
        ) {
          state.addProcess(state.currentProcess);
          state.currentProcess = newProcess;

          state.processes.shift();

          cpu.setCurrentProcess(state.currentProcess);
        }
      });

      state.subscriptions.push(subscription);

      state.subscriptions.push(subscription);

      state.consumeProcess();

      return state.doneProcesses;
    },

    stopQueue: () => {
      state.isRunning = false;

      if (state.interval) {
        clearInterval(state.interval);
      }

      state.subscriptions.forEach((unsubscribe) => unsubscribe());

      cpu.stop();

      console.log("sjfw", state.doneProcesses);
    },
  });

  return state;
};