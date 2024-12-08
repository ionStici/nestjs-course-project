import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationService } from 'src/common/pagination/providers/pagination.service';
import { MetaOption } from 'src/meta-options/meta-option.entity';
import { TagsService } from 'src/tags/providers/tags.service';
import { UsersService } from 'src/users/providers/users.service';
import { Repository } from 'typeorm';
import { CreatePostDto } from '../dtos/create-post.dto';
import { GetPostsDto } from '../dtos/get-posts.dto';
import { PatchPostDto } from '../dtos/patch-post.dto';
import { Post } from '../post.entity';
import { CreatePostProvider } from './create-post.provider';

@Injectable()
export class PostsService {
  constructor(
    /**
     * Inject postsRepository
     */
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    /**
     * Inject metaOptionsRepository
     */
    @InjectRepository(MetaOption)
    public readonly metaOptionsRepository: Repository<MetaOption>,

    /**
     * Injecting Users Service
     */
    private readonly usersService: UsersService,

    /**
     * Inject tagsService
     */
    private readonly tagsService: TagsService,

    private readonly paginationService: PaginationService,

    private readonly createPostProvider: CreatePostProvider,
  ) {}

  /**
   * Creating new posts
   */
  public async create(createPostDto: CreatePostDto, user: ActiveUserData) {
    return await this.createPostProvider.create(createPostDto, user);
  }

  // PAGINATION
  public async findAll(postQuery: GetPostsDto): Promise<Paginated<Post>> {
    const posts = await this.paginationService.paginateQuery(
      { limit: postQuery.limit, page: postQuery.page },
      this.postRepository,
    );

    return posts;
  }

  public async delete(id: number) {
    // Deleting the post
    await this.postRepository.delete(id);

    // Confirmation
    return { deleted: true, id };
  }

  public async update(patchPostDto: PatchPostDto) {
    let tags = undefined;
    let post = undefined;

    // Find the Tags
    try {
      tags = await this.tagsService.findMultipleTags(patchPostDto.tags);
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment, please try later.',
      );
    }

    /**
     * Number of tags need to be equal
     */
    if (!tags || tags.length !== patchPostDto.tags.length) {
      throw new BadRequestException(
        'Please check your tag IDs and ensure they are correct',
      );
    }

    // Find the Post
    try {
      post = await this.postRepository.findOneBy({
        id: patchPostDto.id,
      });
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment, please try later.',
      );
    }

    if (!post) {
      throw new BadRequestException('The post ID does not exist');
    }

    // Update the properties
    post.title = patchPostDto.title ?? post.title;
    post.content = patchPostDto.content ?? post.content;
    post.status = patchPostDto.status ?? post.status;
    post.postType = patchPostDto.postType ?? post.postType;
    post.slug = patchPostDto.slug ?? post.slug;
    post.featuredImageUrl =
      patchPostDto.featuredImageUrl ?? post.featuredImageUrl;
    post.publishOn = patchPostDto.publishOn ?? post.publishOn;

    // Assign the new tags
    post.tags = tags;

    // Save the post and return
    let savedPost = undefined;
    try {
      savedPost = await this.postRepository.save(post);
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment, please try later.',
      );
    }

    return savedPost;
  }
}
