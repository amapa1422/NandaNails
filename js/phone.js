
 (() => {
   const phone = document.getElementById('clientPhone');
   if (!phone) return;
   const digitsOnly = text => text.replace(/\D/g, '').slice(0, 11);
   function formatWhatsapp(value) {
     const d = digitsOnly(value);
     if (!d) return '';
     if (d.length <= 2) return '(' + d + (d.length === 2 ? ')' : '');
     const body = d.slice(2);
     const left = body.length > 4 ? body.slice(0, -4) : body;
     const right = body.length > 4 ? '-' + body.slice(-4) : '';
     return '(' + d.slice(0, 2) + ')' + left + right;
   }
   function mask() {
     const before = phone.value.slice(0, phone.selectionStart ?? phone.value.length);
     const cursorDigits = digitsOnly(before).length;
     const formatted = formatWhatsapp(phone.value);
     phone.value = formatted;
     if (document.activeElement === phone) {
       let pos = 0, count = 0;
       while (pos < formatted.length && count < cursorDigits) {
         if (/\d/.test(formatted[pos])) count++;
         pos++;
       }
       // Mantém o cursor depois do DDD/fechamento do parêntese.
       if (cursorDigits === 2 && formatted[pos] === ')') pos++;
       phone.setSelectionRange(pos, pos);
     }
   }
   phone.addEventListener('input', mask);
   phone.addEventListener('change', mask);
   phone.addEventListener('paste', () => requestAnimationFrame(mask));
   document.getElementById('bookingForm')?.addEventListener('submit', mask, true);
 })();
 