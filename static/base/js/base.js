$(function() {
    var path,
        top,
        layout_state,
        previous_layout_state,
        scroll_state,
        previous_scroll_state;

    top_level = window.location.pathname.substring(1).split('/')[0];
    if (top_level.length === 0) {
        top_level = 'portfolio';
    }

    $('body').attr('id', top_level);
    $('#nav-' + top_level).addClass('active');

    if (window.location.pathname === "/" || window.location.pathname === "/portfolio/") {
        $('.brand').click(function(evt) {
            if (!$(this).data('dont-show-sidebar')) {
                $('#side-menu').toggleClass('active');
                $('#wrapper').toggleClass('shifted');
                evt.stopPropagation();
                return false;
            }
        });
    } else {
        $('.brand').addClass("noMagic");
    }

    $('#wrapper').click(function() {
        $('#side-menu').removeClass('active');
        $('#wrapper').removeClass('shifted');
    });
});
