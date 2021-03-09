$(function() {
  $('.category').hover(function mouseOver(evt) {
    if (!$(this).hasClass('active')) {
      $('.preview' + $(this).data('category-class')).addClass('highlight');
    }
  }, function mouseOut(evt) {
    $('.preview').removeClass('highlight');
  });

  function showAllProjects(evt) {
    $('.preview').show().removeClass('highlight');
    $('.category').removeClass('active');
    $('.brand').data('dont-show-sidebar', false);

    if (evt) {
      evt.stopPropagation();
      return false;
    }
  }

  $('.category').click(function (evt) {
    $('.category').not(this).removeClass('active');
    if ($(this).hasClass('active')) {
      showAllProjects();
    } else {
      $(this).addClass('active');
      $('.preview').show().removeClass('highlight').not($(this).data('category-class')).hide();
      $('.brand').data('dont-show-sidebar', true);
      $('.brand').click(showAllProjects);
    }
  });
});
