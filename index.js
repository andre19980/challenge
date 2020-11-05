const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const _ = require('lodash');

const createAddresses = (type, tags, address) => {
  return ({
    type: type,
    tags: tags,
    address: address,
  });
};

const selectItemsByIndex = (indexes, arr) => {
  if (indexes.length > 1) {
    return indexes.map(index => arr[index]);
  } else {
    return arr[indexes];
  }
}

const formatGroups = (groups) => {
  const regex = /[A-Z][a-z]+( +)?([0-9]+)?/g;
  const formattedGroups = groups.map(group => group.match(regex));

  return _.compact(_.flatten(formattedGroups));
}

const formatBooleans = bool => {
  if (bool === '' || bool === 'no' || bool === '0') return false;
  return true;
}

const rows = [];

fs.createReadStream(path.resolve(__dirname, 'input.csv'))
  .pipe(csv.parse())
  .on('error', error => console.error(error))
  .on('data', row => rows.push(row))
  .on('end', () => {
    const headers = rows[0];

    const mapHeaders = {
      fullname: [],
      eid: [],
      groups: [],
      invisible: [],
      see_all: [],
    };

    headers.forEach((header, index) => {
      if (header === 'fullname') {
        mapHeaders.fullname.push(index);
      } else if (header === 'eid') {
        mapHeaders.eid.push(index);
      } else if (header === 'group') {
        mapHeaders.groups.push(index);
      } else if (header.includes('phone')) {
        typeof mapHeaders[header] !== 'undefined' ? mapHeaders[header].push(index) : mapHeaders[header] = [index];
      } else if (header.includes('email')) {
        typeof mapHeaders[header] !== 'undefined' ? mapHeaders[header].push(index) : mapHeaders[header] = [index];
      } else if (header === 'see_all') {
        mapHeaders.see_all.push(index);
      } else if (header === 'invisible') {
        mapHeaders.invisible.push(index);
      }
    });

    const users = [];
    rows.shift();

    rows.forEach(row => {
      const user = {
        fullname: '',
        eid: '',
        groups: [],
        addresses: [],
        invisible: '',
        see_all: '',
      };

      Object.entries(mapHeaders).forEach(([key, values]) => {
        if (key.includes('email') || key.includes('phone')) {
          const regex = /(email|phone)/g;

          const type = key.match(regex)[0];
          const tags = key.split(' ').slice(1);
          const address = selectItemsByIndex(values, row);

          if (type === 'email') {
            const emailRegex = /[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g;
            const emails = address.match(emailRegex);

            if (emails) {
              emails.forEach(email => {
                const formattedAddress = createAddresses(type, tags, email);

                user['addresses'].push(formattedAddress);
              });
            }
          } else {
            const phoneRegex = /[0-9]/g;
            const digits = address.match(phoneRegex);

            if (digits && digits.length === 11) {
              const phone = '55' + digits.join('');
              const formattedAddress = createAddresses(type, tags, phone);

              user['addresses'].push(formattedAddress);
            }
          }
        } else if (key === 'groups') {
          user[key] = formatGroups(selectItemsByIndex(values, row));
        } else if (key === 'see_all' || key === 'invisible') {
          user[key] = formatBooleans(selectItemsByIndex(values, row));
        } else {
          user[key] = selectItemsByIndex(values, row);
        }
      });

      users.push(user);
    });

    const result = _(users)
      .groupBy('eid')
      .map((g) => _.mergeWith({}, ...g, (obj, src) =>
        _.isArray(obj) ? [...new Set(obj.concat(src))] : undefined))
      .value();

    const str = JSON.stringify(result, null, 1);
    fs.appendFile("output.json", str, (err) => {
      if (err) throw err;
    });
  });
