import type { ElementType, ElementKind } from './compositionTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import { primitiveKernelContracts } from './primitiveKernelContracts';
import { geometryKernelContracts } from './geometryKernelContracts';
import { cinematicKernelContracts } from './cinematicKernelContracts';
/** Rendering ABI limits, independent of content defaults and display metadata. */
export interface KernelContract {
    kind: ElementKind;
    inputParameter?: string;
    parameters: readonly Omit<SceneParameterDescriptor, 'label' | 'defaultValue' | 'defaultBinding'>[];
}
export const kernelContracts: Record<ElementType, KernelContract> = {
    ...primitiveKernelContracts,
    ...geometryKernelContracts,
    ...cinematicKernelContracts,
};
