import { AbilityBuilder, MongoAbility, createMongoAbility, ExtractSubjectType } from '@casl/ability';
import { Injectable } from '@nestjs/common';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subjects = 'Orphan' | 'Employee' | 'Donor' | 'Beneficiary' | 'Role' | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>; 

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.userType === 'ADMIN') {
      can('manage', 'Employee'); 
      can('manage', 'Role');     
      can('read', 'Donor');      
    } else {
      const userPermissions: string[] = user.permissions || [];

      userPermissions.forEach((permission) => {
        const [action, subject] = permission.split(':');
        const formattedSubject = this.mapSubject(subject);

        if (formattedSubject) {
          can(action as Action, formattedSubject);
        }
      });
    }

    return build({
      detectSubjectType: (item) => item as ExtractSubjectType<Subjects>,
    });
  }

  private mapSubject(subject: string): Subjects | null {
    const maps: Record<string, Subjects> = {
      orphans: 'Orphan',
      employees: 'Employee',
      donors: 'Donor',
      beneficiaries: 'Beneficiary',
      roles: 'Role',
    };
    return maps[subject] || null;
  }
}