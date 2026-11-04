import type { Workspace } from '@/data/types';

import { createListStore } from './create-list-store';

export const useWorkspaces = createListStore<Workspace>(['workspace'], (repos) => repos.workspaces.getAll());
