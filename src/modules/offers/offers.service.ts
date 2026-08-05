import {
  createOffer,
  getOffer,
  listAssistantReferralOffers,
  listEligibleOffersForCustomer,
  listOfferRedemptions,
  listOffers,
  setOfferStatus,
  updateOffer,
  validateCustomerOfferCode,
  validateCustomerReferralCode,
  validateOfferById,
  type OfferFilters,
  type OfferInput
} from "./offers.repository.js";

export class OfferMasterService {
  list(filters: OfferFilters) {
    return listOffers(filters);
  }

  get(id: string) {
    return getOffer(id);
  }

  create(input: OfferInput) {
    return createOffer(input);
  }

  update(id: string, input: OfferInput) {
    return updateOffer(id, input);
  }

  validate(id: string) {
    return validateOfferById(id);
  }

  publish(id: string, userId: string) {
    return setOfferStatus(id, "ACTIVE", userId);
  }

  pause(id: string, userId: string) {
    return setOfferStatus(id, "PAUSED", userId);
  }

  archive(id: string, userId: string) {
    return setOfferStatus(id, "ARCHIVED", userId);
  }
}

export class OfferEligibilityService {
  eligibleForCustomer(customerUserId: string, filters: Parameters<typeof listEligibleOffersForCustomer>[1]) {
    return listEligibleOffersForCustomer(customerUserId, filters);
  }
}

export class OfferCodeService {
  validate(customerUserId: string, code: string, filters: Parameters<typeof validateCustomerOfferCode>[2]) {
    return validateCustomerOfferCode(customerUserId, code, filters);
  }
}

export class ReferralCodeService {
  validate(customerUserId: string, code: string) {
    return validateCustomerReferralCode(customerUserId, code);
  }
}

export class OfferValidationService extends OfferMasterService {}
export class OfferPricingService {}
export class PackagePurchaseService {}
export class EntitlementService {}
export class RedemptionService {}

export class OfferReportingService {
  redemptions(offerId: string) {
    return listOfferRedemptions(offerId);
  }
}

export class AssistantReferralOfferService {
  listForAssistant(assistantUserId: string) {
    return listAssistantReferralOffers(assistantUserId);
  }
}
