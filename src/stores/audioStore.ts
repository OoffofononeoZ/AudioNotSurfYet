import { ref, readonly } from 'vue';
const currentEnergy = ref(0);
export const useAudioEnergy = () => readonly(currentEnergy);
export const updateEnergy = (value: number) => {
    currentEnergy.value = value;
};