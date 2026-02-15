import { useParams } from 'react-router-dom';

export type Department = 'external' | 'internal' | 'sports' | 'other';

const departmentLabels: Record<Department, string> = {
  external: 'External Competition',
  internal: 'Internal Competition',
  sports: 'Sports',
  other: 'Other Competition',
};

export const useDepartment = () => {
  const { department } = useParams<{ department: string }>();
  const dept = (department || 'external') as Department;

  return {
    department: dept,
    departmentLabel: departmentLabels[dept] || dept,
  };
};
