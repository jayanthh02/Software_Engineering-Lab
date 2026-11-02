
const registrationRepo = require('../repositories/registrationRepo');

async function register(proposalId, studentId) {
  return registrationRepo.register(proposalId, studentId);
}

module.exports = { register };
