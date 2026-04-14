import type { SectionOptions } from './section';

export function loadZdfMediathek(
    elem: HTMLElement,
    { enableOverflow }: SectionOptions
) {
    let html = '';

    elem.classList.remove('verticalSection');

    html += '<div class="verticalSection verticalSection-extrabottompadding">';
    html += '<h2 class="sectionTitle sectionTitle-cards padded-left">ZDF Mediathek</h2>';

    html += enableOverflow
        ? '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true"><div class="itemsContainer scrollSlider focuscontainer-x">'
        : '<div class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x">';

    html += '<a is="emby-linkbutton" href="#/zdfhome" class="raised homeLibraryButton homeLibraryButton-zdf">';
    html += '<span class="material-icons homeLibraryIcon live_tv" aria-hidden="true"></span>';
    html += '<span class="homeLibraryText">ZDF Mediathek</span>';
    html += '</a>';

    html += '</div>';
    if (enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.innerHTML = html;
}
