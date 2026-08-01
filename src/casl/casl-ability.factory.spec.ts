import { UserType } from '@prisma/client';
import { AdminBeneficiariesController } from '../beneficiary/beneficiary.controller';
import { CHECK_ABILITY } from '../decorators/abilities.decorator';
import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory beneficiary review permission', () => {
  const factory = new CaslAbilityFactory();

  it('allows an employee with status:beneficiaries permission', () => {
    const ability = factory.createForUser({
      id: 1,
      userType: UserType.EMPLOYEE,
      permissions: ['status:beneficiaries'],
    });

    expect(ability.can('status', 'Beneficiary')).toBe(true);
  });

  it('denies an employee without status:beneficiaries permission', () => {
    const ability = factory.createForUser({
      id: 2,
      userType: UserType.EMPLOYEE,
      permissions: ['read:beneficiaries'],
    });

    expect(ability.can('status', 'Beneficiary')).toBe(false);
  });

  it('maps sponsorship permissions for authorized staff', () => {
    const ability = factory.createForUser({
      id: 3,
      userType: UserType.EMPLOYEE,
      permissions: ['read:sponsorships', 'status:sponsorships'],
    });

    expect(ability.can('read', 'Sponsorship')).toBe(true);
    expect(ability.can('status', 'Sponsorship')).toBe(true);
  });

  it('allows admins to manage sponsorships', () => {
    const ability = factory.createForUser({
      id: 4,
      userType: UserType.ADMIN,
      permissions: [],
    });

    expect(ability.can('read', 'Sponsorship')).toBe(true);
    expect(ability.can('status', 'Sponsorship')).toBe(true);
  });

  it('protects the beneficiary status endpoint with the review permission', () => {
    const requiredAbility = Reflect.getMetadata(
      CHECK_ABILITY,
      AdminBeneficiariesController.prototype.reviewStatus,
    );

    expect(requiredAbility).toEqual({
      action: 'status',
      subject: 'Beneficiary',
    });
  });
});
