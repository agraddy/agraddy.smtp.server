var mod = {};

mod.smtp = {};

mod.smtp.accounts = [];
mod.smtp.accounts.push('basic@example.com');
mod.smtp.accounts.push('reject@example.com');
mod.smtp.accounts.push('custom@example.com');
mod.smtp.accounts.push('^.*@example.net$');
mod.smtp.accounts.push('stream@example.com');

mod.smtp.banner = 'Howdy partner!';

mod.smtp.fqdn = 'mail.example.com';

module.exports = mod;
