import { UserType } from '@prisma/client';
import { ADMIN_PERMISSION_NAMES } from '../../prisma/seeds/roles.seed';
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

  it('does not grant admins permissions that are absent from their role', () => {
    const ability = factory.createForUser({
      id: 4,
      userType: UserType.ADMIN,
      permissions: [],
    });

    expect(ability.can('read', 'Sponsorship')).toBe(false);
    expect(ability.can('update', 'Orphan')).toBe(false);
    expect(ability.can('create', 'AnnualReport')).toBe(false);
  });

  it('grants admins only the permissions supplied by their role', () => {
    const ability = factory.createForUser({
      id: 4,
      userType: UserType.ADMIN,
      permissions: ['create:employees', 'read:employees', 'read:sponsorships'],
    });

    expect(ability.can('create', 'Employee')).toBe(true);
    expect(ability.can('read', 'Employee')).toBe(true);
    expect(ability.can('read', 'Sponsorship')).toBe(true);
    expect(ability.can('delete', 'Employee')).toBe(false);
    expect(ability.can('status', 'Sponsorship')).toBe(false);
  });

  it.each([
    ['create', 'Employee'],
    ['delete', 'Employee'],
    ['read', 'Employee'],
    ['update', 'Employee'],
    ['create', 'Role'],
    ['delete', 'Role'],
    ['read', 'Role'],
    ['update', 'Role'],
    ['read', 'RequestAid'],
    ['read', 'Beneficiary'],
    ['read', 'Donor'],
    ['read', 'Orphan'],
    ['read', 'QuickAidFund'],
    ['read', 'SponsorshipFund'],
    ['read', 'Sponsorship'],
  ] as const)('maps the admin role permission to %s:%s', (action, subject) => {
    const ability = factory.createForUser({
      id: 4,
      userType: UserType.ADMIN,
      permissions: ADMIN_PERMISSION_NAMES,
    });

    expect(ability.can(action, subject)).toBe(true);
  });

  it('maps annual report creation permission for authorized staff', () => {
    const ability = factory.createForUser({
      id: 5,
      userType: UserType.EMPLOYEE,
      permissions: ['create:annual_reports'],
    });

    expect(ability.can('create', 'AnnualReport')).toBe(true);
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
