const KEY = 'eubanks_jobs_v1';
const form = document.querySelector('#form');

const money = n =>
  Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });

function read() {
  try {
    const jobs = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
}

function save(jobs) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
}

function estimate() {
  const data = new FormData(form);
  const number = key => Math.max(0, Number(data.get(key)) || 0);
  const cost =
    number('materials') +
    number('hours') * number('rate') +
    number('other');

  return {
    cost,
    price: Math.round(cost * (1 + number('markup') / 100) * 100) / 100
  };
}

function update() {
  document.querySelector('#total').textContent = money(estimate().price);
}

form.addEventListener('input', update);

form.addEventListener('submit', event => {
  event.preventDefault();

  const data = new FormData(form);
  const { cost, price } = estimate();
  const job = {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    customer: String(data.get('customer') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    service: String(data.get('service') || ''),
    description: String(data.get('description') || '').trim(),
    cost,
    price,
    status: 'Estimate'
  };

  if (!job.customer || !job.description) return;

  try {
    save([job, ...read()]);
    form.reset();
    update();
    render();
  } catch {
    alert('Could not save. Export your records and check device storage.');
  }
});

function render() {
  const target = document.querySelector('#jobs');
  target.replaceChildren();
  const jobs = read();

  if (!jobs.length) {
    target.textContent = 'No jobs saved yet.';
    return;
  }

  for (const job of jobs) {
    const wrap = document.createElement('div');
    wrap.className = 'job';

    const title = document.createElement('strong');
    title.textContent = job.customer + ' — ' + job.service;

    const info = document.createElement('p');
    info.textContent = job.description;

    const amount = document.createElement('p');
    amount.textContent = 'Estimate: ' + money(job.price);

    const select = document.createElement('select');

    for (const status of [
      'Estimate',
      'Approved',
      'Scheduled',
      'In Progress',
      'Completed',
      'Paid'
    ]) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      select.append(option);
    }

    select.value = job.status || 'Estimate';

    select.addEventListener('change', () => {
      const status = select.value;
      try {
        save(read().map(saved =>
          saved.id === job.id ? { ...saved, status } : saved
        ));
        job.status = status;
      } catch {
        select.value = job.status;
        alert('Could not save the status change.');
      }
    });

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'secondary';
    copy.textContent = 'Copy customer estimate';

    copy.onclick = async () => {
      const content = [
        'EUBANKS PROPERTY SOLUTIONS',
        'Quality Work. Honest Service. Lasting Results.',
        'Customer: ' + job.customer,
        'Service: ' + job.service,
        'Scope: ' + job.description,
        'Flat-rate estimate: ' + money(job.price),
        'Subject to scope confirmation and approval.'
      ].join('\n');

      try {
        await navigator.clipboard.writeText(content);
        alert('Estimate copied');
      } catch {
        prompt('Copy estimate:', content);
      }
    };

    wrap.append(title, info, amount, select, copy);
    target.append(wrap);
  }
}

document.querySelector('#export').onclick = () => {
  const backup = {
    format: 'eubanks-v1',
    jobs: read()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    'eubanks-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

document.querySelector('#import').onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > 2000000) throw Error('File too large');

    const data = JSON.parse(await file.text());

    if (
      data.format !== 'eubanks-v1' ||
      !Array.isArray(data.jobs) ||
      data.jobs.length > 10000 ||
      !data.jobs.every(job =>
        job &&
        typeof job.id === 'string' &&
        typeof job.customer === 'string' &&
        typeof job.service === 'string' &&
        typeof job.description === 'string' &&
        typeof job.price === 'number' &&
        Number.isFinite(job.price) &&
        job.price >= 0
      )
    ) {
      throw Error('Invalid backup');
    }

    if (!confirm('Replace all saved jobs with this backup?')) return;

    save(data.jobs);
    render();
  } catch (error) {
    alert('Backup not restored: ' + error.message);
  } finally {
    event.target.value = '';
  }
};

update();
render();
